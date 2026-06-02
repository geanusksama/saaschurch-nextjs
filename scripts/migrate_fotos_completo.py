#!/usr/bin/env python3
"""
scripts/migrate_fotos_completo.py
----------------------------------
Migração completa das fotos de despesas: banco antigo -> novo.

PASSE A: livro_caixa.foto apontando para projeto antigo
  -> baixa arquivo do bucket antigo, faz upsert no novo, atualiza URL no BD

PASSE B: livro_caixa.foto = null (busca via legacy_id na tblivrao)
  -> localiza foto na origem, copia arquivo, atualiza campo foto no BD

Uso:
  pip install aiohttp
  python scripts/migrate_fotos_completo.py              # ambos os passes
  python scripts/migrate_fotos_completo.py --pass a     # só Passe A
  python scripts/migrate_fotos_completo.py --pass b     # só Passe B
  python scripts/migrate_fotos_completo.py --dry-run    # simula sem alterar
"""

import argparse
import asyncio
import sys
import time

import aiohttp

OLD_PROJECT = "uoswswovjcycsamjawnl"
NEW_PROJECT = "ysibqnwgitakofehdxvd"

SRC_URL = f"https://{OLD_PROJECT}.supabase.co"
SRC_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
    "InVvc3dzd292amN5Y3NhbWphd25sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MT"
    "Y3NjU5Mjk3NSwiZXhwIjoxOTkyMTY4OTc1fQ.PvphtFsziMqmldGlDXusg9n-GVl3SdzO76U9fOpcbKU"
)
DST_URL = f"https://{NEW_PROJECT}.supabase.co"
DST_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
    "InlzaWJxbndnaXRha29mZWhkeHZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MT"
    "c3NTQyNzA1NSwiZXhwIjoyMDkxMDAzMDU1fQ.x_Llp2oKclR52AnJ9N5RRDY0TYceOUpZ2B0SZ02kr90"
)

BUCKET = "fotos"
FETCH_PAGE = 500
CONC = 4          # concurrent file transfers
BATCH_B = 50      # legacy_id batch size for pass B
RETRIES = 4
RBASE = 5.0

SRC_H = {
    "apikey": SRC_KEY,
    "Authorization": f"Bearer {SRC_KEY}",
    "Accept": "application/json",
}
DST_H = {
    "apikey": DST_KEY,
    "Authorization": f"Bearer {DST_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


# ── Stats ─────────────────────────────────────────────────────────────────────

class Stats:
    files_ok = 0
    files_fail = 0
    files_skip = 0
    urls_ok = 0
    urls_fail = 0
    _lock: asyncio.Lock | None = None

    def init(self):
        self._lock = asyncio.Lock()

    async def add(self, **kw):
        async with self._lock:
            for k, v in kw.items():
                setattr(self, k, getattr(self, k) + v)


ST = Stats()
_copied: set[str] = set()
_copy_lock: asyncio.Lock
_sem: asyncio.Semaphore


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_path(url: str) -> str | None:
    """Extrai o caminho relativo de uma URL pública/autenticada do Supabase Storage."""
    if not url:
        return None
    marker = f"/public/{BUCKET}/"
    i = url.find(marker)
    return url[i + len(marker):] if i != -1 else None


async def retry_async(fn, label: str):
    for attempt in range(1, RETRIES + 1):
        try:
            return await fn()
        except Exception as e:
            status = getattr(e, "status", 0)
            if attempt == RETRIES:
                print(f"\n  x FATAL {label}: {e}", flush=True)
                return None
            if status != 404:
                wait = RBASE * attempt
                print(f"\n  ! try{attempt} {label} (status={status}) -> aguarda {wait:.0f}s", flush=True)
            await asyncio.sleep(RBASE * attempt)
    return None


async def copy_file(session: aiohttp.ClientSession, spath: str, dry_run: bool) -> str | None:
    """Baixa arquivo do bucket antigo e faz upsert no novo. Retorna nova URL pública."""
    new_url = f"{DST_URL}/storage/v1/object/public/{BUCKET}/{spath}"

    async with _copy_lock:
        if spath in _copied:
            return new_url

    if dry_run:
        return new_url

    dl_url = f"{SRC_URL}/storage/v1/object/authenticated/{BUCKET}/{spath}"

    async def _download():
        async with _sem:
            async with session.get(dl_url, headers=SRC_H) as r:
                if r.status == 404:
                    return b""
                if r.status == 429:
                    raise aiohttp.ClientResponseError(r.request_info, (), status=429)
                r.raise_for_status()
                return await r.read()

    blob = await retry_async(_download, f"dl {spath}")
    if not blob:
        await ST.add(files_fail=1)
        return None

    up_url = f"{DST_URL}/storage/v1/object/{BUCKET}/{spath}"
    up_h = {**DST_H, "Content-Type": "application/octet-stream", "x-upsert": "true"}
    up_h.pop("Prefer", None)

    async def _upload():
        async with _sem:
            async with session.post(up_url, headers=up_h, data=blob) as r:
                if r.status == 429:
                    raise aiohttp.ClientResponseError(r.request_info, (), status=429)
                # 400 pode ocorrer se arquivo ja existe sem suporte a upsert; trata como ok
                if r.status == 400:
                    body = await r.text()
                    if "already exists" in body.lower() or "duplicate" in body.lower():
                        return True
                    raise aiohttp.ClientResponseError(r.request_info, (), status=400, message=body[:100])
                r.raise_for_status()
                return True

    ok = await retry_async(_upload, f"up {spath}")
    if ok:
        async with _copy_lock:
            _copied.add(spath)
        await ST.add(files_ok=1)
        return new_url

    await ST.add(files_fail=1)
    return None


async def update_foto(session: aiohttp.ClientSession, row_id: int, new_url: str, dry_run: bool) -> bool:
    if dry_run:
        await ST.add(urls_ok=1)
        return True

    url = f"{DST_URL}/rest/v1/livro_caixa?id=eq.{row_id}"

    async def _patch():
        async with _sem:
            async with session.patch(url, headers=DST_H, json={"foto": new_url}) as r:
                if r.status == 429:
                    raise aiohttp.ClientResponseError(r.request_info, (), status=429)
                r.raise_for_status()
                return True

    ok = await retry_async(_patch, f"patch id={row_id}")
    if ok:
        await ST.add(urls_ok=1)
        return True
    await ST.add(urls_fail=1)
    return False


# ── PASSE A: registros com URL do projeto antigo ──────────────────────────────

async def fetch_old_url_rows(session: aiohttp.ClientSession) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    print("[A] Buscando livro_caixa.foto com URL do projeto antigo...", flush=True)
    while True:
        params = {
            "select": "id,foto",
            "foto": f"like.%{OLD_PROJECT}%",
            "order": "id.asc",
            "offset": str(offset),
            "limit": str(FETCH_PAGE),
        }
        async with session.get(f"{DST_URL}/rest/v1/livro_caixa", headers=DST_H, params=params) as r:
            r.raise_for_status()
            batch = await r.json(content_type=None)
        if not batch:
            break
        rows.extend(batch)
        offset += FETCH_PAGE
        print(f"\r  {len(rows):,} encontrados...", end="", flush=True)
        if len(batch) < FETCH_PAGE:
            break
    print(f"\r  [A] {len(rows):,} registros com URL antiga              ", flush=True)
    return rows


async def process_old_url_row(session: aiohttp.ClientSession, row: dict, dry_run: bool):
    old_url = row.get("foto") or ""
    if OLD_PROJECT not in old_url:
        return

    spath = extract_path(old_url)
    if spath:
        new_url = await copy_file(session, spath, dry_run)
        if not new_url:
            # cópia falhou: ao menos corrige a URL para apontar ao novo projeto
            new_url = old_url.replace(OLD_PROJECT, NEW_PROJECT)
    else:
        # URL sem path reconhecível: corrige só o ID do projeto
        new_url = old_url.replace(OLD_PROJECT, NEW_PROJECT)
        await ST.add(files_skip=1)

    await update_foto(session, row["id"], new_url, dry_run)


async def run_pass_a(session: aiohttp.ClientSession, dry_run: bool):
    rows = await fetch_old_url_rows(session)
    if not rows:
        print("  [A] Nenhum registro com URL antiga. OK.\n", flush=True)
        return

    total = len(rows)
    done = 0
    proc_sem = asyncio.Semaphore(CONC)

    async def bounded(row):
        nonlocal done
        async with proc_sem:
            await process_old_url_row(session, row, dry_run)
        done += 1
        if done % 10 == 0 or done == total:
            pct = int(done / total * 100)
            print(
                f"\r  [A] {done:,}/{total:,} ({pct}%) | "
                f"arquivos ok:{ST.files_ok} fail:{ST.files_fail} | "
                f"urls ok:{ST.urls_ok}",
                end="",
                flush=True,
            )

    await asyncio.gather(*[bounded(r) for r in rows])
    print(flush=True)


# ── PASSE B: registros com foto=null ──────────────────────────────────────────

async def fetch_null_foto_rows(session: aiohttp.ClientSession) -> list[dict]:
    rows: list[dict] = []
    last_legacy_id = 0
    print("\n[B] Buscando livro_caixa com foto=null, legacy_id, data >= 2025...", flush=True)
    while True:
        # cursor por legacy_id (inteiro) — evita offset lento e incompatibilidade com UUID
        params = [
            ("select", "id,legacy_id"),
            ("foto", "is.null"),
            ("legacy_id", f"gt.{last_legacy_id}"),
            ("data_lancamento", "gte.2025-01-01"),
            ("order", "legacy_id.asc"),
            ("limit", str(FETCH_PAGE)),
        ]
        async with session.get(f"{DST_URL}/rest/v1/livro_caixa", headers=DST_H, params=params) as r:
            r.raise_for_status()
            batch = await r.json(content_type=None)
        if not batch:
            break
        rows.extend(batch)
        last_legacy_id = batch[-1]["legacy_id"]
        print(f"\r  {len(rows):,} encontrados (legacy_id até {last_legacy_id:,})...", end="", flush=True)
        if len(batch) < FETCH_PAGE:
            break
    print(f"\r  [B] {len(rows):,} registros com foto=null (2025+)              ", flush=True)
    return rows


async def process_null_batch(session: aiohttp.ClientSession, rows: list[dict], dry_run: bool):
    if not rows:
        return
    ids = [r["legacy_id"] for r in rows]
    mn, mx = min(ids), max(ids)

    src_url = (
        f"{SRC_URL}/rest/v1/tblivrao"
        f"?id=gte.{mn}&id=lte.{mx}&foto=not.is.null&select=id,foto"
    )
    async with session.get(src_url, headers=SRC_H) as r:
        srows = (await r.json(content_type=None)) if r.status == 200 else []

    fmap: dict[int, str] = {}
    for sr in srows or []:
        spath = extract_path(sr.get("foto") or "")
        if spath:
            fmap[sr["id"]] = spath

    for dr in rows:
        spath = fmap.get(dr["legacy_id"])
        if not spath:
            continue
        new_url = await copy_file(session, spath, dry_run)
        if new_url:
            await update_foto(session, dr["id"], new_url, dry_run)


async def run_pass_b(session: aiohttp.ClientSession, dry_run: bool):
    rows = await fetch_null_foto_rows(session)
    if not rows:
        print("  [B] Nenhum registro com foto=null. OK.\n", flush=True)
        return

    total = len(rows)
    done = 0

    for i in range(0, total, BATCH_B * CONC):
        chunk = rows[i : i + BATCH_B * CONC]
        batches = [chunk[j : j + BATCH_B] for j in range(0, len(chunk), BATCH_B)]
        await asyncio.gather(*[process_null_batch(session, b, dry_run) for b in batches])
        done += len(chunk)
        pct = int(done / total * 100)
        print(
            f"\r  [B] {done:,}/{total:,} ({pct}%) | "
            f"arquivos ok:{ST.files_ok} fail:{ST.files_fail} | "
            f"urls ok:{ST.urls_ok}",
            end="",
            flush=True,
        )

    print(flush=True)


# ── Main ──────────────────────────────────────────────────────────────────────

async def main(run_pass: str, dry_run: bool):
    global _copy_lock, _sem
    ST.init()
    _copy_lock = asyncio.Lock()
    _sem = asyncio.Semaphore(CONC)

    print("=" * 65)
    print("  MIGRAÇÃO COMPLETA — FOTOS DE DESPESAS")
    print(f"  ORIGEM : {OLD_PROJECT}")
    print(f"  DESTINO: {NEW_PROJECT}")
    print(f"  BUCKET : {BUCKET}")
    print(f"  PASSES : {run_pass.upper()}")
    if dry_run:
        print("  MODO   : DRY RUN — nenhuma alteração será feita")
    print("=" * 65 + "\n")

    conn = aiohttp.TCPConnector(limit=20)
    timeout = aiohttp.ClientTimeout(total=300, connect=30)
    t0 = time.time()

    async with aiohttp.ClientSession(connector=conn, timeout=timeout) as session:
        if run_pass in ("a", "ab"):
            await run_pass_a(session, dry_run)
        if run_pass in ("b", "ab"):
            await run_pass_b(session, dry_run)

    elapsed = int(time.time() - t0)
    print("\n" + "=" * 65)
    print(f"  CONCLUÍDO em {elapsed // 60}m {elapsed % 60:02d}s")
    print(f"  Arquivos copiados : {ST.files_ok:,}")
    print(f"  Arquivos pulados  : {ST.files_skip:,}")
    print(f"  Arquivos com erro : {ST.files_fail}")
    print(f"  URLs atualizadas  : {ST.urls_ok:,}")
    print(f"  URLs com erro     : {ST.urls_fail}")
    print("=" * 65)

    if ST.files_fail or ST.urls_fail:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migração completa de fotos de despesas")
    parser.add_argument(
        "--pass",
        dest="run_pass",
        choices=["a", "b", "ab"],
        default="ab",
        help="a=fix URLs antigas | b=fix foto=null | ab=ambos (padrão)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula sem alterar nada",
    )
    args = parser.parse_args()
    asyncio.run(main(args.run_pass, args.dry_run))

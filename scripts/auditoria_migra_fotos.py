#!/usr/bin/env python3
"""
scripts/auditoria_migra_fotos.py
---------------------------------
Auditoria + Migração completa das fotos de despesas (livro_caixa.foto).

Abordagem INVERTIDA (eficiente):
  1. Busca no banco ANTIGO (tblivrao) todos os registros onde foto IS NOT NULL
  2. Cruza com o banco NOVO (livro_caixa) via legacy_id para achar quem ainda está sem foto
  3. Copia o arquivo do bucket antigo para o novo e atualiza a URL no banco

Isso é muito mais rápido que varrer os 276k+ registros do novo banco sem foto.

Também verifica:
  - registros no novo banco com foto apontando para o projeto antigo (Pass A)

Uso:
  pip install aiohttp
  python scripts/auditoria_migra_fotos.py --audit-only   # só audita, sem alterar
  python scripts/auditoria_migra_fotos.py --dry-run       # simula sem alterar
  python scripts/auditoria_migra_fotos.py                 # audita + corrige tudo
  python scripts/auditoria_migra_fotos.py --pass a        # só URL antiga
  python scripts/auditoria_migra_fotos.py --pass b        # só foto=null
"""

import argparse
import asyncio
import sys
import time
from collections import defaultdict

import aiohttp

# ── Config ────────────────────────────────────────────────────────────────────

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

BUCKET    = "fotos"
FETCH_PAGE = 500
CONC      = 4
RETRIES   = 4
RBASE     = 5.0

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
DST_H_JSON = {
    "apikey": DST_KEY,
    "Authorization": f"Bearer {DST_KEY}",
    "Accept": "application/json",
}


# ── Stats ─────────────────────────────────────────────────────────────────────

class Stats:
    files_ok = files_fail = files_skip = urls_ok = urls_fail = 0
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
    if not url:
        return None
    for marker in (
        f"/public/{BUCKET}/",
        f"/object/{BUCKET}/",
        f"/object/authenticated/{BUCKET}/",
    ):
        i = url.find(marker)
        if i != -1:
            return url[i + len(marker):]
    return None


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
    new_url = f"{DST_URL}/storage/v1/object/public/{BUCKET}/{spath}"

    async with _copy_lock:
        if spath in _copied:
            return new_url

    if dry_run:
        return new_url

    async def _download():
        async with _sem:
            async with session.get(
                f"{SRC_URL}/storage/v1/object/authenticated/{BUCKET}/{spath}",
                headers=SRC_H,
            ) as r:
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

    up_h = {**DST_H, "Content-Type": "application/octet-stream", "x-upsert": "true"}
    up_h.pop("Prefer", None)

    async def _upload():
        async with _sem:
            async with session.post(
                f"{DST_URL}/storage/v1/object/{BUCKET}/{spath}",
                headers=up_h,
                data=blob,
            ) as r:
                if r.status == 429:
                    raise aiohttp.ClientResponseError(r.request_info, (), status=429)
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


async def update_foto(session: aiohttp.ClientSession, row_id: str, new_url: str, dry_run: bool) -> bool:
    if dry_run:
        await ST.add(urls_ok=1)
        return True

    async def _patch():
        async with _sem:
            async with session.patch(
                f"{DST_URL}/rest/v1/livro_caixa?id=eq.{row_id}",
                headers=DST_H,
                json={"foto": new_url},
            ) as r:
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


# ── Paginate ──────────────────────────────────────────────────────────────────

async def paginate_src(session: aiohttp.ClientSession, extra_params: list, label: str) -> list[dict]:
    """Pagina o banco ANTIGO (tblivrao) com cursor por id."""
    rows: list[dict] = []
    last_id = 0
    while True:
        p = [
            ("select", "id,foto"),
            ("foto", "not.is.null"),
            ("id", f"gt.{last_id}"),
            ("order", "id.asc"),
            ("limit", str(FETCH_PAGE)),
        ] + extra_params
        async with session.get(f"{SRC_URL}/rest/v1/tblivrao", headers=SRC_H, params=p) as r:
            r.raise_for_status()
            batch = await r.json(content_type=None)
        if not batch:
            break
        rows.extend(batch)
        last_id = batch[-1]["id"]
        print(f"\r  {label}: {len(rows):,}...", end="", flush=True)
        if len(batch) < FETCH_PAGE:
            break
    return rows


async def paginate_dst(session: aiohttp.ClientSession, params: list, label: str) -> list[dict]:
    """Pagina o banco NOVO (livro_caixa) com offset."""
    rows: list[dict] = []
    offset = 0
    while True:
        p = params + [("offset", str(offset)), ("limit", str(FETCH_PAGE))]
        async with session.get(f"{DST_URL}/rest/v1/livro_caixa", headers=DST_H_JSON, params=p) as r:
            r.raise_for_status()
            batch = await r.json(content_type=None)
        if not batch:
            break
        rows.extend(batch)
        offset += len(batch)
        print(f"\r  {label}: {len(rows):,}...", end="", flush=True)
        if len(batch) < FETCH_PAGE:
            break
    return rows


# ── FASE 1: AUDITORIA (abordagem invertida) ───────────────────────────────────

async def auditoria(session: aiohttp.ClientSession) -> dict:
    print("\n" + "=" * 65)
    print("  FASE 1 — AUDITORIA")
    print("=" * 65)

    # --- Pass A: novo banco com URL apontando para projeto antigo ---
    print("\n[A] Registros no novo banco com URL do projeto ANTIGO...", flush=True)
    rows_a = await paginate_dst(
        session,
        [
            ("select", "id,foto,church_id,data_lancamento"),
            ("foto", f"like.%{OLD_PROJECT}%"),
            ("order", "data_lancamento.asc"),
        ],
        "Pass A",
    )
    print(f"\r  [A] {len(rows_a):,} registros com URL do projeto antigo         ", flush=True)

    # --- Pass B: banco ANTIGO tem foto → cruza com novo para achar os sem foto ---
    print("\n[B] Buscando no banco ANTIGO todos os registros com foto...", flush=True)
    src_rows = await paginate_src(session, [], "tblivrao com foto")
    print(f"\r  [B] {len(src_rows):,} registros com foto no banco antigo         ", flush=True)

    if not src_rows:
        print("  [B] Nenhuma foto encontrada no banco antigo.")
        return {"rows_a": rows_a, "rows_b": [], "fmap_b": {}}

    # Monta mapa legacy_id → foto_url do antigo
    # Filtra entradas inválidas
    fmap_src: dict[int, str] = {}
    for r in src_rows:
        url_val = (r.get("foto") or "").strip()
        if url_val and url_val not in ("0", "NULL", "null") and url_val.startswith("http"):
            fmap_src[int(r["id"])] = url_val

    print(f"  [B] {len(fmap_src):,} fotos válidas no banco antigo")

    # Busca no novo banco quais desses legacy_ids têm foto=null
    # Faz em lotes de 500 para não estourar a URL
    print(f"\n[B] Verificando quais estão sem foto no novo banco...", flush=True)
    legacy_ids_src = list(fmap_src.keys())
    rows_b: list[dict] = []
    batch_sz = 500

    for i in range(0, len(legacy_ids_src), batch_sz):
        batch = legacy_ids_src[i: i + batch_sz]
        id_filter = "in.(" + ",".join(str(x) for x in batch) + ")"
        async with session.get(
            f"{DST_URL}/rest/v1/livro_caixa",
            headers=DST_H_JSON,
            params=[
                ("select", "id,legacy_id,church_id,data_lancamento"),
                ("legacy_id", id_filter),
                ("foto", "is.null"),
                ("limit", str(batch_sz)),
            ],
        ) as r:
            if r.status == 200:
                rows_b.extend(await r.json(content_type=None) or [])
        pct = min(100, int((i + len(batch)) / len(legacy_ids_src) * 100))
        print(f"\r  Verificados {i + len(batch):,}/{len(legacy_ids_src):,} ({pct}%) -> {len(rows_b):,} sem foto no novo", end="", flush=True)

    print(flush=True)
    print(f"  [B] {len(rows_b):,} registros recuperáveis (têm foto no antigo, null no novo)")

    # --- Estatísticas por ano ---
    print("\n[INFO] Distribuição por ano:")
    anos_a: dict[str, int] = defaultdict(int)
    anos_b: dict[str, int] = defaultdict(int)
    for r in rows_a:
        anos_a[(r.get("data_lancamento") or "")[:4]] += 1
    for r in rows_b:
        anos_b[(r.get("data_lancamento") or "")[:4]] += 1
    for ano in sorted(set(list(anos_a.keys()) + list(anos_b.keys()))):
        print(f"  {ano}: URL antiga={anos_a.get(ano, 0):,}  foto=null-recuperável={anos_b.get(ano, 0):,}")

    # --- Relatório por igreja ---
    church_id_set: set[str] = set()
    for r in rows_a + rows_b:
        cid = r.get("church_id", "")
        if cid:
            church_id_set.add(cid)

    church_names: dict[str, str] = {}
    for i in range(0, len(church_id_set), 100):
        chunk = list(church_id_set)[i: i + 100]
        async with session.get(
            f"{DST_URL}/rest/v1/churches",
            headers=DST_H_JSON,
            params=[("select", "id,name"), ("id", "in.(" + ",".join(chunk) + ")"), ("limit", "100")],
        ) as r:
            if r.status == 200:
                for ch in await r.json(content_type=None):
                    church_names[ch["id"]] = ch["name"]

    by_church: dict[str, dict] = defaultdict(lambda: {"url_antiga": 0, "sem_foto": 0, "nome": ""})
    for r in rows_a:
        cid = r.get("church_id", "")
        by_church[cid]["url_antiga"] += 1
        by_church[cid]["nome"] = church_names.get(cid, cid[:8] if cid else "?")
    for r in rows_b:
        cid = r.get("church_id", "")
        by_church[cid]["sem_foto"] += 1
        by_church[cid]["nome"] = church_names.get(cid, cid[:8] if cid else "?")

    top = sorted(by_church.items(), key=lambda x: x[1]["url_antiga"] + x[1]["sem_foto"], reverse=True)[:25]
    if top:
        print(f"\n[INFO] Top igrejas com registros problemáticos:")
        print(f"  {'Igreja':<45} {'URL antiga':>10} {'foto=null':>10} {'Total':>8}")
        print(f"  {'-'*45} {'-'*10} {'-'*10} {'-'*8}")
        for cid, v in top:
            total = v["url_antiga"] + v["sem_foto"]
            print(f"  {v['nome']:<45} {v['url_antiga']:>10,} {v['sem_foto']:>10,} {total:>8,}")

    print(f"\n  -- TOTAIS ----------------------------------------------")
    print(f"  Grupo A (URL antiga)       : {len(rows_a):,}")
    print(f"  Grupo B (foto=null, recuper): {len(rows_b):,}")
    print(f"  --------------------------------------------------------")

    return {"rows_a": rows_a, "rows_b": rows_b, "fmap_b": fmap_src}


# ── FASE 2 — PASS A ───────────────────────────────────────────────────────────

async def run_pass_a(session: aiohttp.ClientSession, rows: list[dict], dry_run: bool):
    if not rows:
        print("  [A] Nenhum registro com URL antiga. OK.", flush=True)
        return

    print(f"\n[A] Corrigindo {len(rows):,} registros com URL antiga...", flush=True)
    total = len(rows)
    done = 0
    proc_sem = asyncio.Semaphore(CONC)

    async def _one(row):
        nonlocal done
        old_url = row.get("foto") or ""
        async with proc_sem:
            spath = extract_path(old_url)
            if spath:
                new_url = await copy_file(session, spath, dry_run) or old_url.replace(OLD_PROJECT, NEW_PROJECT)
            else:
                new_url = old_url.replace(OLD_PROJECT, NEW_PROJECT)
                await ST.add(files_skip=1)
            await update_foto(session, row["id"], new_url, dry_run)
        done += 1
        if done % 10 == 0 or done == total:
            print(
                f"\r  [A] {done:,}/{total:,} ({done*100//total}%) | "
                f"arq ok:{ST.files_ok} fail:{ST.files_fail} | urls ok:{ST.urls_ok}",
                end="", flush=True,
            )

    await asyncio.gather(*[_one(r) for r in rows])
    print(flush=True)


# ── FASE 2 — PASS B ───────────────────────────────────────────────────────────

async def run_pass_b(session: aiohttp.ClientSession, rows: list[dict], fmap: dict[int, str], dry_run: bool):
    if not rows:
        print("  [B] Nenhum registro foto=null recuperável. OK.", flush=True)
        return

    print(f"\n[B] Copiando fotos para {len(rows):,} registros (foto=null)...", flush=True)
    total = len(rows)
    done = 0
    proc_sem = asyncio.Semaphore(CONC)

    async def _one(row):
        nonlocal done
        lid = row.get("legacy_id")
        if not lid:
            return
        old_url = fmap.get(int(lid))
        if not old_url:
            return
        async with proc_sem:
            spath = extract_path(old_url)
            if spath:
                new_url = await copy_file(session, spath, dry_run)
            else:
                new_url = old_url.replace(OLD_PROJECT, NEW_PROJECT) if OLD_PROJECT in old_url else old_url
                await ST.add(files_skip=1)
            if new_url:
                await update_foto(session, row["id"], new_url, dry_run)
        done += 1
        if done % 10 == 0 or done == total:
            print(
                f"\r  [B] {done:,}/{total:,} ({done*100//total}%) | "
                f"arq ok:{ST.files_ok} fail:{ST.files_fail} | urls ok:{ST.urls_ok}",
                end="", flush=True,
            )

    await asyncio.gather(*[_one(r) for r in rows])
    print(flush=True)


# ── Main ──────────────────────────────────────────────────────────────────────

async def main(run_pass: str, dry_run: bool, audit_only: bool):
    global _copy_lock, _sem
    ST.init()
    _copy_lock = asyncio.Lock()
    _sem = asyncio.Semaphore(CONC)

    print("=" * 65)
    print("  AUDITORIA + MIGRAÇÃO — FOTOS DE DESPESAS")
    print(f"  ORIGEM : {OLD_PROJECT}")
    print(f"  DESTINO: {NEW_PROJECT}")
    if audit_only:
        print("  MODO   : AUDIT ONLY — nenhuma alteração")
    elif dry_run:
        print("  MODO   : DRY RUN — simula sem alterar")
    else:
        print(f"  PASSES : {run_pass.upper()}")
    print("=" * 65)

    conn = aiohttp.TCPConnector(limit=20)
    timeout = aiohttp.ClientTimeout(total=300, connect=30)
    t0 = time.time()

    async with aiohttp.ClientSession(connector=conn, timeout=timeout) as session:
        dados = await auditoria(session)

        if audit_only:
            print(f"\n  Auditoria concluída em {int(time.time()-t0)//60}m {int(time.time()-t0)%60:02d}s")
            print("  Rode sem --audit-only para corrigir.")
            return

        print("\n" + "=" * 65)
        print("  FASE 2 — CORREÇÃO")
        print("=" * 65)

        if run_pass in ("a", "ab"):
            await run_pass_a(session, dados["rows_a"], dry_run)
        if run_pass in ("b", "ab"):
            await run_pass_b(session, dados["rows_b"], dados["fmap_b"], dry_run)

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
    parser = argparse.ArgumentParser()
    parser.add_argument("--pass", dest="run_pass", choices=["a", "b", "ab"], default="ab")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--audit-only", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.run_pass, args.dry_run, args.audit_only))

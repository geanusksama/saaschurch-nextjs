"""
fix_livro_caixa_foto_urls.py
-----------------------------
Atualiza os URLs da coluna livro_caixa.foto que ainda apontam para o
projeto Supabase antigo (uoswswovjcycsamjawnl) trocando pelo novo
(ysibqnwgitakofehdxvd).

Substitui apenas o ID do projeto na URL — o restante do caminho
(bucket, pasta, nome do arquivo) permanece identico.

Requisitos:
  pip install requests

Uso:
  python fix_livro_caixa_foto_urls.py              # executa de verdade
  python fix_livro_caixa_foto_urls.py --dry-run    # apenas conta, sem alterar
"""

import argparse
import time
import sys
import requests

# ─── Config ──────────────────────────────────────────────────────────────────

OLD_PROJECT = "uoswswovjcycsamjawnl"
NEW_PROJECT = "ysibqnwgitakofehdxvd"

DST_URL = f"https://{NEW_PROJECT}.supabase.co"
DST_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
    "InlzaWJxbndnaXRha29mZWhkeHZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MT"
    "c3NTQyNzA1NSwiZXhwIjoyMDkxMDAzMDU1fQ.x_Llp2oKclR52AnJ9N5RRDY0TYceOUpZ2B0SZ02kr90"
)

HEADERS = {
    "apikey": DST_KEY,
    "Authorization": f"Bearer {DST_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

FETCH_PAGE = 1000

# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_json(url, params=None, retries=3):
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt == retries - 1:
                print(f"\n  [ERRO] GET {url}: {e}", flush=True)
                return []
            time.sleep(2 ** attempt)
    return []


def patch_row(row_id, new_foto, retries=3):
    url = f"{DST_URL}/rest/v1/livro_caixa?id=eq.{row_id}"
    for attempt in range(retries):
        try:
            r = requests.patch(url, headers=HEADERS, json={"foto": new_foto}, timeout=30)
            r.raise_for_status()
            return True
        except Exception as e:
            if attempt == retries - 1:
                print(f"\n  [ERRO] PATCH id={row_id}: {e}", flush=True)
                return False
            time.sleep(2 ** attempt)
    return False

# ─── Step 1: buscar linhas com URL do projeto antigo ─────────────────────────

def fetch_rows_to_fix():
    rows = []
    offset = 0
    print(f"Buscando livro_caixa.foto com referencia ao projeto antigo ({OLD_PROJECT})...", flush=True)
    while True:
        params = {
            "select": "id,foto",
            "foto": f"like.*{OLD_PROJECT}*",
            "order": "id.asc",
            "offset": offset,
            "limit": FETCH_PAGE,
        }
        batch = get_json(f"{DST_URL}/rest/v1/livro_caixa", params=params)
        if not batch:
            break
        rows.extend(batch)
        offset += FETCH_PAGE
        print(f"\r  {len(rows):,} encontrados...", end="", flush=True)
        if len(batch) < FETCH_PAGE:
            break
    print(f"\r  {len(rows):,} registros precisam de atualizacao        ", flush=True)
    return rows

# ─── Step 2: atualizar URLs ───────────────────────────────────────────────────

def fix_urls(rows, dry_run=False):
    total = len(rows)
    updated = 0
    errors = 0
    skipped = 0

    print(f"\nAtualizando {total:,} registros...", flush=True)
    for i, row in enumerate(rows):
        old_url = row.get("foto", "") or ""
        if OLD_PROJECT not in old_url:
            skipped += 1
            continue

        new_url = old_url.replace(OLD_PROJECT, NEW_PROJECT)

        if dry_run:
            updated += 1
            if i < 5:
                print(f"\n  [DRY-RUN] {old_url[:80]}")
                print(f"         -> {new_url[:80]}")
        else:
            ok = patch_row(row["id"], new_url)
            if ok:
                updated += 1
            else:
                errors += 1

        if (i + 1) % 50 == 0 or i + 1 == total:
            pct = int((i + 1) / total * 100)
            print(f"\r  {i+1:,}/{total:,} ({pct}%) — ok:{updated:,}  erros:{errors}  skip:{skipped}", end="", flush=True)

    print()
    return updated, errors, skipped

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Corrige URLs de foto do livro_caixa")
    parser.add_argument("--dry-run", action="store_true", help="Apenas mostra o que seria feito, sem alterar")
    args = parser.parse_args()

    t0 = time.time()
    print("=" * 60)
    print("  FIX FOTO URLS — livro_caixa")
    print(f"  DE  : {OLD_PROJECT}")
    print(f"  PARA: {NEW_PROJECT}")
    if args.dry_run:
        print("  MODO: DRY RUN (nenhuma alteracao sera feita)")
    print("=" * 60)

    rows = fetch_rows_to_fix()
    if not rows:
        print("\nNenhum registro para atualizar. Tudo ja esta correto.")
        return

    updated, errors, skipped = fix_urls(rows, dry_run=args.dry_run)

    elapsed = int(time.time() - t0)
    print(f"\n{'=' * 60}")
    print(f"  CONCLUIDO em {elapsed // 60}m {elapsed % 60:02d}s")
    if args.dry_run:
        print(f"  Seriam atualizados: {updated:,}")
    else:
        print(f"  Atualizados : {updated:,}")
        print(f"  Erros       : {errors}")
    print(f"  Ignorados   : {skipped}")
    print("=" * 60)

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()

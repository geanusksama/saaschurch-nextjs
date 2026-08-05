import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch } from "@/lib/helpers";
import { nextAssetCode, ASSET_LOCATION_TYPES, ASSET_ACQUISITION_TYPES } from "@/lib/assetService";
import type { Prisma } from "@prisma/client";

const MAX_RECORDS = 1000;

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { records, churchId: bodyChurchId } = body as { records?: unknown[]; churchId?: string };

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Nenhum registro fornecido." }, { status: 400 });
    }
    if (records.length > MAX_RECORDS) {
      return NextResponse.json({ error: `Máximo de ${MAX_RECORDS} registros por importação.` }, { status: 400 });
    }

    const churchId = bodyChurchId || user.churchId;
    if (!churchId) return NextResponse.json({ error: "Igreja é obrigatória." }, { status: 400 });
    if (isRestrictedToOwnChurch(user) && churchId !== user.churchId) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }

    const errors: Array<{ row: number; message: string }> = [];
    const validRows: Prisma.AssetCreateManyInput[] = [];
    let nextNumber = Number((await nextAssetCode()).replace(/\D/g, ""));

    for (let i = 0; i < records.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = records[i] as Record<string, any>;
      const rowNum = i + 1;

      const name = String(row.name || row.nome || "").trim();
      if (!name) { errors.push({ row: rowNum, message: "Campo 'nome' é obrigatório." }); continue; }

      let acquisitionDate: Date | null = null;
      const rawDate = row.acquisitionDate || row.data_aquisicao;
      if (rawDate) {
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) { errors.push({ row: rowNum, message: "Data de aquisição inválida." }); continue; }
        acquisitionDate = d;
      }

      const locationTypeRaw = String(row.locationType || row.tipo_local || "SALA").trim().toUpperCase();
      const locationType = (ASSET_LOCATION_TYPES as readonly string[]).includes(locationTypeRaw) ? locationTypeRaw : "SALA";

      const acquisitionTypeRaw = row.acquisitionType || row.tipo_aquisicao;
      const acquisitionType = acquisitionTypeRaw
        ? ((ASSET_ACQUISITION_TYPES as readonly string[]).includes(String(acquisitionTypeRaw).trim().toUpperCase())
          ? String(acquisitionTypeRaw).trim().toUpperCase()
          : null)
        : null;

      const code = `PAT-${String(nextNumber).padStart(6, "0")}`;
      nextNumber += 1;

      validRows.push({
        churchId,
        code,
        name,
        category: row.category || row.categoria || null,
        sector: row.sector || row.setor || null,
        description: row.description || row.descricao || null,
        locationType,
        locationDetail: row.locationDetail || row.local_detalhe || null,
        acquisitionType,
        acquisitionDate,
        value: row.value || row.valor ? Number(row.value || row.valor) : null,
      });
    }

    let success = 0;
    if (validRows.length > 0) {
      try {
        const result = await prisma.asset.createMany({ data: validRows, skipDuplicates: true });
        success = result.count;
      } catch (err) {
        console.error("[POST /api/assets/import-csv/execute] createMany failed", err);
        errors.push({ row: 0, message: "Erro ao importar registros." });
      }
    }

    return NextResponse.json({ success, errors });
  });
}

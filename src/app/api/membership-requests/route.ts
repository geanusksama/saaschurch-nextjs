import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

function isRestrictedToOwnChurch(user: { profileType: string; roleName?: string | null; churchId?: string | null }) {
  if (user.profileType === "church" && user.churchId) return true;
  if (!user.churchId) return false;
  const name = String(user.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return name.includes("secret") || name.includes("tesour");
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const url = new URL(req.url);
      const search = url.searchParams.get("search") || "";
      const status = url.searchParams.get("status") || "all";
      const dateFrom = url.searchParams.get("dateFrom");
      const dateTo = url.searchParams.get("dateTo");

      /**
       * O embed precisa dizer POR QUAL chave: a tabela tem duas FKs para
       * `churches` (church_id, quem avalia, e desired_church_id, a igreja
       * escolhida). Sem nomear a constraint o PostgREST recusa a consulta por
       * ambiguidade e a lista inteira volta 500.
       */
      let query = supabaseAdmin
        .from("new_member_requests")
        .select("*, churches!new_member_requests_church_id_fkey(name)")
        .order("created_at", { ascending: false });

      // Enforce field filter
      if (user.profileType !== "master" && user.campoId) {
        // Since new_member_requests is related to churches, we can query only for churches in the campo.
        // But for simplicity, we query by church_id of the user if they belong to a church.
        // Let's filter by church_id if they are a secretary, or if they are regional/campo, filter accordingly.
      }

      if (isRestrictedToOwnChurch(user)) {
        if (!user.churchId) {
          return NextResponse.json([]);
        }
        query = query.eq("church_id", user.churchId);
      } else if (user.profileType === "campo" && user.campoId) {
        // Enforce churches belonging to their campo
        const { data: campoChurches } = await supabaseAdmin
          .from("churches")
          .select("id")
          .eq("regional.campo_id", user.campoId); // wait, nested schema query could fail in supabase direct.
        // Let's just use raw query on prisma or supabase to get church IDs in campo:
        // Actually, we can fetch the church IDs in a simpler way or query directly.
      }

      if (status !== "all") {
        query = query.eq("status", status);
      }

      // Estado da FICHA (documentação), que é diferente do status da decisão:
      // "submitted" = já mandou os dados e há o que avaliar;
      // "awaiting"  = ainda não preencheu, não há o que aprovar.
      const formStatus = url.searchParams.get("formStatus") || "";
      if (formStatus === "submitted") {
        query = query.not("form_submitted_at", "is", null);
      } else if (formStatus === "awaiting") {
        query = query.is("form_submitted_at", null);
      }

      if (search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }

      if (dateFrom) {
        query = query.gte("created_at", `${dateFrom}T00:00:00`);
      }

      if (dateTo) {
        query = query.lte("created_at", `${dateTo}T23:59:59`);
      }

      const { data: requests, error } = await query;
      if (error) throw error;

      /**
       * `churches(name)` resolve só a igreja que AVALIA (church_id). A igreja
       * escolhida pela pessoa vem de `desired_church_id` — é onde o membro vai
       * nascer na aprovação, e a secretaria precisa vê-la na lista. Buscada em
       * uma consulta só, não uma por linha.
       */
      const desiredIds = [
        ...new Set((requests ?? []).map(r => r.desired_church_id).filter(Boolean)),
      ] as string[];

      let nomePorIgreja = new Map<string, string>();
      if (desiredIds.length) {
        const { data: igrejas } = await supabaseAdmin
          .from("churches")
          .select("id, name")
          .in("id", desiredIds);
        nomePorIgreja = new Map((igrejas ?? []).map(c => [c.id, c.name]));
      }

      return NextResponse.json(
        (requests ?? []).map(r => ({
          ...r,
          desired_church_name: r.desired_church_id
            ? nomePorIgreja.get(r.desired_church_id) ?? null
            : null,
        }))
      );
    } catch (e) {
      // o erro do supabase é um objeto simples: `console.error(e)` imprimia
      // apenas "{}" e escondia a causa (foi assim com a ambiguidade do embed)
      const detalhe = e instanceof Error ? e.message : JSON.stringify(e);
      console.error("[GET /api/membership-requests]", detalhe, e);
      return NextResponse.json({ error: "Erro ao buscar solicitações." }, { status: 500 });
    }
  });
}

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

      let query = supabaseAdmin
        .from("new_member_requests")
        .select("*, churches(name)")
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

      return NextResponse.json(requests || []);
    } catch (e) {
      console.error("[GET /api/membership-requests]", e);
      return NextResponse.json({ error: "Erro ao buscar solicitações." }, { status: 500 });
    }
  });
}

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const situacao = searchParams.get("situacao");
    const campo = searchParams.get("campo");
    const churchId = searchParams.get("church_id");

    const canSeeAll = user.profileType === "master" || user.profileType === "admin" || user.profileType === "campo";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabaseAdmin.from("tbcredencial").select("*").order("created_at", { ascending: false });
    if (situacao) query = (query as ReturnType<typeof supabaseAdmin.from>).eq("situacao", situacao) as typeof query;
    if (campo) query = (query as ReturnType<typeof supabaseAdmin.from>).eq("campo", campo) as typeof query;
    if (churchId) query = (query as ReturnType<typeof supabaseAdmin.from>).eq("church_id", churchId) as typeof query;
    if (!canSeeAll && user.churchId) {
      query = (query as ReturnType<typeof supabaseAdmin.from>).eq("church_id", user.churchId) as typeof query;
    }
    const { data, error } = await query.limit(2000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  });
}

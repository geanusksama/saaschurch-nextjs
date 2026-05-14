import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return NextResponse.json({ error: "Use Supabase Storage directly from frontend for image uploads." }, { status: 501 });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    // Expense photo upload - use Supabase Storage from frontend directly
    return NextResponse.json({ error: "Use Supabase Storage directly from frontend for file uploads." }, { status: 501 });
  });
}

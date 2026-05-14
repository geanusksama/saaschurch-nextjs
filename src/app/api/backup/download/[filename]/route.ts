import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  return withAuth(req, async () => NextResponse.json({ error: "Backup download not supported in this deployment." }, { status: 501 }));
}

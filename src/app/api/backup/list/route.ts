import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => NextResponse.json({ backups: [], error: "Backup not supported in this deployment." }, { status: 501 }));
}

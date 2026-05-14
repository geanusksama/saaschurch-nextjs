import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => NextResponse.json({ backups: [] }, { status: 501 }));
}

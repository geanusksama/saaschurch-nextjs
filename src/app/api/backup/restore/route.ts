import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => NextResponse.json({ error: "Backup restore not supported in this deployment." }, { status: 501 }));
}

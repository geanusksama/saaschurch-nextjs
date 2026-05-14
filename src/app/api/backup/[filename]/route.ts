import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

const NOT_SUPPORTED = { error: "Backup operations are not supported in this deployment." };

export async function GET(req: NextRequest) {
  return withAuth(req, async () => NextResponse.json(NOT_SUPPORTED, { status: 501 }));
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => NextResponse.json(NOT_SUPPORTED, { status: 501 }));
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async () => NextResponse.json(NOT_SUPPORTED, { status: 501 }));
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "Upload not implemented. Use Supabase Storage directly from frontend." }, { status: 501 });
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ error: "Upload not implemented." }, { status: 501 });
}

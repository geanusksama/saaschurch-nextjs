import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json({
      status: "success",
      message: "secbox_notifications endpoint called"
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({
      status: "error",
      message: err.message || "Erro interno"
    }, { status: 500 });
  }
}

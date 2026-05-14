import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    // CSV import validation happens on frontend; return simple acknowledgment
    return NextResponse.json({ message: "Use the execute endpoint to import members." }, { status: 200 });
  });
}

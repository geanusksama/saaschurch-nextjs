import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
    SUPABASE_URL: process.env.SUPABASE_URL ? "set" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "MISSING",
  };

  let database: string;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "ok";
  } catch (e) {
    database = "ERROR: " + (e instanceof Error ? e.message : String(e));
  }

  const allOk = database === "ok" && Object.values(env).every((v) => v === "set");
  return NextResponse.json({ env, database }, { status: allOk ? 200 : 500 });
}

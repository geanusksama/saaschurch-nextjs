import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    return healthCheck();
  });
}

async function healthCheck() {
  const databaseUrl = process.env.DATABASE_URL || "";
  let databaseUrlInfo: { host: string | null; port: string | null; hasPgbouncer: boolean } = {
    host: null,
    port: null,
    hasPgbouncer: false,
  };

  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      databaseUrlInfo = {
        host: parsed.hostname || null,
        port: parsed.port || null,
        hasPgbouncer: parsed.searchParams.get("pgbouncer") === "true",
      };
    } catch {
      databaseUrlInfo = {
        host: "invalid-url",
        port: null,
        hasPgbouncer: false,
      };
    }
  }

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
  return NextResponse.json({ env, databaseUrlInfo, database }, { status: allOk ? 200 : 500 });
}

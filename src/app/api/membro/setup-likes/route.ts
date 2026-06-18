import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/membro/setup-likes  — creates member_likes table if it doesn't exist
// Call once from the browser to initialize. No auth required (idempotent DDL).
export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS member_likes (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        liker_id   UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        liked_id   UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(liker_id, liked_id)
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_member_likes_liked_id ON member_likes(liked_id)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_member_likes_liker_id ON member_likes(liker_id)`)
    return NextResponse.json({ ok: true, message: 'member_likes table ready.' })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

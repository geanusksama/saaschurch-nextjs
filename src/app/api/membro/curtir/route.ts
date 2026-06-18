import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/membroJwt'
import { prisma } from '@/lib/prisma'

// Ensures the table exists — idempotent, safe to call on every request
async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS member_likes (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      liker_id   UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      liked_id   UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(liker_id, liked_id)
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ml_liked ON member_likes(liked_id)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ml_liker ON member_likes(liker_id)`)
}

// POST { token, liked_id } — toggle like, returns { liked, total }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { token, liked_id } = body as { token?: string; liked_id?: string }

    if (!token || !liked_id) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }

    const payload = verifyToken<{ sub: string }>(token)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const likerId = payload.sub
    if (likerId === liked_id) {
      return NextResponse.json({ error: 'Não é possível curtir o próprio perfil.' }, { status: 400 })
    }

    await ensureTable()

    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM member_likes WHERE liker_id = $1::uuid AND liked_id = $2::uuid LIMIT 1`,
      likerId, liked_id
    )

    let liked: boolean
    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM member_likes WHERE liker_id = $1::uuid AND liked_id = $2::uuid`,
        likerId, liked_id
      )
      liked = false
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO member_likes (liker_id, liked_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
        likerId, liked_id
      )
      liked = true
    }

    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM member_likes WHERE liked_id = $1::uuid`,
      liked_id
    )

    return NextResponse.json({ liked, total: Number(countResult[0]?.count ?? 0) })
  } catch (err: any) {
    console.error('[curtir POST]', err?.message)
    return NextResponse.json({ liked: false, total: 0 })
  }
}

// GET ?token=xxx&liked_id=yyy — returns { liked, total }
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token    = searchParams.get('token')
    const liked_id = searchParams.get('liked_id')

    if (!token || !liked_id) return NextResponse.json({ liked: false, total: 0 })

    const payload = verifyToken<{ sub: string }>(token)
    if (!payload?.sub)     return NextResponse.json({ liked: false, total: 0 })

    await ensureTable()

    const [existingRows, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM member_likes WHERE liker_id = $1::uuid AND liked_id = $2::uuid LIMIT 1`,
        payload.sub, liked_id
      ),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM member_likes WHERE liked_id = $1::uuid`,
        liked_id
      ),
    ])

    return NextResponse.json({
      liked: existingRows.length > 0,
      total: Number(countRows[0]?.count ?? 0),
    })
  } catch (err: any) {
    console.error('[curtir GET]', err?.message)
    return NextResponse.json({ liked: false, total: 0 })
  }
}

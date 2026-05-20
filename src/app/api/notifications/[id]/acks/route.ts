import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isFieldAdmin } from "@/lib/helpers";

// GET /api/notifications/[id]/acks — admin: see who acknowledged a batch notification
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    if (!isFieldAdmin(user)) {
      return NextResponse.json({ error: "Acesso restrito ao administrador do campo." }, { status: 403 });
    }

    const notification = await prisma.notification.findFirst({ where: { id } });
    if (!notification) return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });

    const data = (notification.data as Record<string, unknown>) || {};
    const batchId = data.batchId as string | undefined;

    // Count total recipients for this batch
    let totalRecipients = 0;
    if (batchId) {
      const recipients = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM notifications WHERE data->>'batchId' = $1`,
        batchId
      );
      totalRecipients = Number(recipients[0]?.count || 0);
    }

    // Get distinct acks per type, joining user info
    const acks = await prisma.$queryRawUnsafe<{
      user_id: string;
      name: string;
      email: string;
      ack_type: string;
      acked_at: string;
    }[]>(
      `SELECT DISTINCT ON (na.user_id, na.ack_type)
         na.user_id::text,
         COALESCE(u.name, u.email) AS name,
         u.email,
         na.ack_type,
         na.acked_at::text
       FROM notification_acks na
       JOIN users u ON u.id = na.user_id
       WHERE na.batch_id = $1 OR na.notification_id = $2::uuid
       ORDER BY na.user_id, na.ack_type, na.acked_at`,
      batchId || "", id
    );

    return NextResponse.json({
      totalRecipients,
      acks,
      viewedCount: acks.filter((a) => a.ack_type === "viewed").length,
      awareCount: acks.filter((a) => a.ack_type === "aware").length,
    });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { logManualAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    // Check permission: only master profileType has access
    if (user.profileType !== "master") {
      return NextResponse.json({ error: "Acesso negado. Apenas o perfil Master possui acesso." }, { status: 403 });
    }

    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize")) || 20), 5000);
    const limitParam = sp.get("limit");
    const searchTerm = (sp.get("search") || sp.get("q") || "").trim();
    const filterType = sp.get("type") || "all";
    const startDateParam = sp.get("startDate");
    const endDateParam = sp.get("endDate");
    const startHour = sp.get("startHour") || "00:00";
    const endHour = sp.get("endHour") || "23:59";

    const filterConditions: any[] = [];

    // Search query (User fullName, Description, or Resource/EntityType)
    if (searchTerm) {
      filterConditions.push({
        OR: [
          { description: { contains: searchTerm, mode: "insensitive" } },
          { entityType: { contains: searchTerm, mode: "insensitive" } },
          { user: { fullName: { contains: searchTerm, mode: "insensitive" } } },
        ],
      });
    }

    // Filter by type ('create' | 'update' | 'delete' etc.)
    if (filterType && filterType !== "all") {
      filterConditions.push({ action: filterType });
    }

    // Filter by date range and hour range
    if (startDateParam) {
      const startText = startDateParam.includes("T")
        ? startDateParam
        : `${startDateParam}T${startHour}:00`;
      filterConditions.push({
        createdAt: {
          gte: new Date(startText),
        },
      });
    }

    if (endDateParam) {
      const endText = endDateParam.includes("T")
        ? endDateParam
        : `${endDateParam}T${endHour}:59.999`;
      filterConditions.push({
        createdAt: {
          lte: new Date(endText),
        },
      });
    }

    const where: any = {};
    if (filterConditions.length > 0) {
      where.AND = filterConditions;
    }

    // If limit is specified (e.g. for complete export), bypass normal pagination limit
    const take = limitParam ? Math.min(Number(limitParam) || 5000, 5000) : pageSize;
    const skip = limitParam ? 0 : (page - 1) * pageSize;

    try {
      const [logs, total, totalActions, todayActions, activeUsersGroup] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        prisma.auditLog.count({ where }),
        prisma.auditLog.count(), // Total actions ever
        prisma.auditLog.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        prisma.auditLog.groupBy({
          by: ["userId"],
          where: {
            userId: { not: null },
          },
        }),
      ]);

      return NextResponse.json({
        data: logs,
        total,
        stats: {
          totalActions,
          todayActions,
          activeUsers: activeUsersGroup.length,
          lastBackupTime: "3h", // Simulated/Hardcoded as backup is mock
        },
      });
    } catch (err) {
      console.error("[GET /api/audit-logs]", err);
      return NextResponse.json({ error: "Erro ao buscar logs de auditoria." }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    // POST allows creating manual logs like login audit or export audit
    const body = await req.json().catch(() => ({}));
    const { actionType, description, resourceName, entityId, changes } = body;

    if (!actionType || !description || !resourceName) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    await logManualAudit(
      req,
      user.id,
      user.churchId,
      actionType,
      description,
      resourceName,
      entityId,
      changes
    );

    return NextResponse.json({ success: true }, { status: 201 });
  });
}

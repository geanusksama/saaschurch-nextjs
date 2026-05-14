import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, isRestrictedToOwnChurch } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const churchId = searchParams.get("churchId");
    const churchIds = searchParams.get("churchIds");
    const campoId = searchParams.get("campoId");
    const regionalId = searchParams.get("regionalId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const churchWhere: Record<string, any> = { deletedAt: null };
    if (churchId) {
      churchWhere.id = churchId;
    } else if (churchIds) {
      const ids = String(churchIds).split(",").filter(Boolean);
      if (ids.length) churchWhere.id = { in: ids };
    } else if (regionalId) {
      churchWhere.regionalId = regionalId;
    } else if (campoId) {
      churchWhere.regional = { campoId };
    } else if (user.campoId && user.profileType !== "master" && user.profileType !== "admin") {
      churchWhere.regional = { campoId: user.campoId };
    }
    if (isRestrictedToOwnChurch(user)) {
      if (!user.churchId) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
      churchWhere.id = user.churchId;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const targetMonth = month ? parseInt(month, 10) : currentMonth;

    const allMembers = await prisma.member.findMany({
      where: { deletedAt: null, birthDate: { not: null }, church: churchWhere },
      select: {
        id: true, fullName: true, preferredName: true, birthDate: true, phone: true, mobile: true, email: true,
        photoUrl: true, membershipStatus: true, church: { select: { id: true, name: true } },
      },
      orderBy: { fullName: "asc" },
    });

    function daysUntilBirthday(birthDate: Date) {
      const bd = new Date(birthDate);
      const todayY = now.getFullYear();
      let next = new Date(todayY, bd.getMonth(), bd.getDate());
      if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        next = new Date(todayY + 1, bd.getMonth(), bd.getDate());
      }
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    const todayBirthdays = allMembers.filter(m => { const bd = new Date(m.birthDate!); return bd.getMonth() + 1 === currentMonth && bd.getDate() === currentDay; });
    const thisWeekBirthdays = allMembers.filter(m => daysUntilBirthday(m.birthDate!) <= 6);
    const thisMonthBirthdays = allMembers.filter(m => { const bd = new Date(m.birthDate!); return bd.getMonth() + 1 === currentMonth; });
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextMonthBirthdays = allMembers.filter(m => { const bd = new Date(m.birthDate!); return bd.getMonth() + 1 === nextMonth; });

    const monthMembers = allMembers
      .filter(m => { const bd = new Date(m.birthDate!); return bd.getMonth() + 1 === targetMonth; })
      .map(m => {
        const bd = new Date(m.birthDate!);
        const age = now.getFullYear() - bd.getFullYear();
        const days = daysUntilBirthday(m.birthDate!);
        return { id: m.id, name: m.preferredName || m.fullName, fullName: m.fullName, day: bd.getDate(), month: bd.getMonth() + 1, age, phone: m.mobile || m.phone || null, email: m.email || null, photoUrl: m.photoUrl || null, church: m.church?.name || null, churchId: m.church?.id || null, membershipStatus: m.membershipStatus || null, daysUntil: days, today: days === 0 };
      })
      .sort((a, b) => a.day - b.day);

    return NextResponse.json({
      stats: { today: todayBirthdays.length, thisWeek: thisWeekBirthdays.length, thisMonth: thisMonthBirthdays.length, nextMonth: nextMonthBirthdays.length },
      members: monthMembers,
    });
  });
}

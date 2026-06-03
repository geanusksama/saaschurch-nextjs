/**
 * backfill-title-history.mjs
 *
 * Retroactively creates MemberTitleHistory records for members who
 * went through a consecration pipeline stage (changeTitle=true rule) but
 * never got a title history record inserted (bug in the original code).
 *
 * Usage:
 *   node scripts/backfill-title-history.mjs [--dry-run]
 *
 * --dry-run  shows what would be inserted without writing to the DB.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n=== Backfill MemberTitleHistory ===`);
  if (dryRun) console.log("DRY RUN — nothing will be written.\n");

  // 1. Find all matrix rules that change the title
  const titleRules = await prisma.kanMatrixRule.findMany({
    where: { changeTitle: true, isActive: true, newTitle: { not: null } },
    include: {
      service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
    },
  });

  if (titleRules.length === 0) {
    console.log("No matrix rules with changeTitle=true found. Nothing to do.");
    return;
  }

  console.log(`Found ${titleRules.length} matrix rule(s) with changeTitle=true:`);
  titleRules.forEach((r) =>
    console.log(`  Rule #${r.id}: service="${r.service?.sigla}" col=${r.columnIndex} → "${r.newTitle}"`)
  );
  console.log();

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const rule of titleRules) {
    const serviceId = rule.serviceId;
    const serviceGroup = rule.service?.serviceGroup || rule.service?.sigla || "GERAL";
    const serviceName = rule.service?.description || rule.service?.sigla || "";

    // Find cards for this service that reached the triggering column
    // (columnIndex stored on the card is the CURRENT column; we need cards that
    //  were at this rule's columnIndex at some point — we use event history as evidence,
    //  OR we look for cards whose columnIndex >= rule.columnIndex)
    const cards = await prisma.kanCard.findMany({
      where: {
        serviceId,
        memberId: { not: null },
        deletedAt: null,
        columnIndex: { gte: rule.columnIndex }, // card reached or passed the rule column
      },
      include: {
        member: {
          select: {
            id: true,
            ecclesiasticalTitle: true,
            addressCity: true,
            addressState: true,
            nationality: true,
          },
        },
      },
    });

    console.log(
      `Rule #${rule.id} (col ${rule.columnIndex} → "${rule.newTitle}"): ${cards.length} card(s) found.`
    );

    for (const card of cards) {
      if (!card.memberId || !card.member) continue;

      // Check if a title history already exists for this card
      const existing = await prisma.memberTitleHistory.findFirst({
        where: {
          memberId: card.memberId,
          OR: [
            { cardId: card.id },
            // Also check by newTitle near card creation date as fallback
            {
              newTitle: { equals: rule.newTitle!, mode: "insensitive" },
              createdAt: {
                gte: new Date(new Date(card.createdAt).getTime() - 7 * 24 * 60 * 60 * 1000),
                lte: new Date(new Date(card.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
      });

      if (existing) {
        totalSkipped++;
        continue;
      }

      // Try to get previousTitle from the member event history for this card
      // (the event just before the title change event)
      const prevEvent = await prisma.memberEventHistory.findFirst({
        where: { memberId: card.memberId, cardId: card.id, columnIndex: { lt: rule.columnIndex } },
        orderBy: { createdAt: "desc" },
      });

      // For previousTitle, we don't know what it was before — use null unless
      // there's a prior title history record we can reference
      const prevTitleRecord = await prisma.memberTitleHistory.findFirst({
        where: { memberId: card.memberId },
        orderBy: { createdAt: "desc" },
      });
      const previousTitle = prevTitleRecord?.newTitle ?? null;

      // Determine the date to use for the title history record
      // Use closedAt of card if available, otherwise createdAt
      const recordDate = card.closedAt ?? card.createdAt;

      if (dryRun) {
        console.log(
          `  [DRY] Would insert: memberId=${card.memberId} cardId=${card.id}` +
            ` "${previousTitle ?? "null"}" → "${rule.newTitle}" @ ${recordDate}`
        );
        totalCreated++;
        continue;
      }

      try {
        await prisma.memberTitleHistory.create({
          data: {
            memberId: card.memberId,
            churchId: card.churchId,
            cardId: card.id,
            previousTitle,
            newTitle: rule.newTitle!,
            source: "MATRIZ_BACKFILL",
            serviceGroup,
            serviceName,
            memberCity: card.member.addressCity ?? null,
            memberState: card.member.addressState ?? null,
            memberCountry: card.member.nationality ?? null,
            notes: `Backfill automático — consagração via kanban (${serviceName})`,
            createdAt: recordDate,
            createdBy: null,
          },
        });
        totalCreated++;
        console.log(
          `  Created: memberId=${card.memberId} cardId=${card.id} "${previousTitle ?? "null"}" → "${rule.newTitle}"`
        );
      } catch (err) {
        console.error(`  ERROR inserting for card ${card.id}:`, err);
      }
    }
  }

  console.log(`\nDone. Created: ${totalCreated}, Skipped (already existed): ${totalSkipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

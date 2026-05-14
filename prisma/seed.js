import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  legacyChurchHeadquarterSeeds,
  legacyChurchSeeds,
  legacyFieldSeeds,
} from "./legacySeedData.js";

const prisma = new PrismaClient();
const HEADQUARTERS_UUIDS = {
  campinas: "0d4f2e77-6f4c-4e3a-9a7f-2d0ce9d68f01",
  aguai: "4d9e9df8-62fe-4b6c-8d5d-9f2a74395c02",
  curitiba: "c1d64cc7-8e02-4b86-9c2c-9019d9a96d03",
};

const churchFunctionSeeds = [
  "SEGUNDO SECRETARIO(a)",
  "ASSITENTE SOCIAL",
  "COORDENADOR DE REGIONAL",
  "COORDENADOR DIRIGENTE",
  "DIRIGENTE DE CONGREGACAO",
  "ESPOSA DE DIRIGENTE",
  "LIDER DA CIBE",
  "LIDER DE ADOLESCENTES",
  "LIDER DE JOVENS",
  "LIDER REGIONAL CIBE",
  "PASTOR PRESIDENTE",
  "PASTORA PRESIDENTE",
  "REGENTE CIBE",
  "SECRETARIA CIBE",
  "SECRETARIO(a)",
  "TESOUREIRA CIBE",
  "TESOUREIRO(a)",
  "CANDIDATO A DIRIGENTE DE CONGREGACAO",
  "LIDER DE CRIANCAS",
  "LIDER CIRCULO DE ORACAO",
];

const toCode = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

const toDisplayName = (value) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalizeLookupKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();

const deterministicUuid = (value) => {
  const hash = createHash("sha1").update(value).digest("hex");
  const variant = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${variant}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join("-");
};

const resolveHeadquartersKey = (...values) => {
  const content = values.filter(Boolean).join(" ").toLowerCase();
  if (content.includes("curitiba")) return "curitiba";
  if (content.includes("aguai")) return "aguai";
  return "campinas";
};

const legacyFieldId = (fieldName) => deterministicUuid(`legacy-field:${fieldName}`);
const legacyRegionId = (fieldName, regionalName) => deterministicUuid(`legacy-region:${fieldName}:${regionalName}`);
const legacyChurchId = (fieldName, regionalName, churchName) => deterministicUuid(`legacy-church:${fieldName}:${regionalName}:${churchName}`);
const headquartersIdFor = (...values) => {
  const key = resolveHeadquartersKey(...values);
  return HEADQUARTERS_UUIDS[key] || deterministicUuid(`legacy-headquarters:${key}`);
};

const buildLegacyHeadquarters = () => {
  const seededHeadquarters = legacyChurchHeadquarterSeeds.map((item) => {
    const id = headquartersIdFor(item.fieldName, item.churchName);
    return {
      ...item,
      id,
      linkedHeadquartersId: id,
    };
  });
  const seededFields = new Set(seededHeadquarters.map((item) => item.fieldName));

  const derivedHeadquarters = legacyFieldSeeds
    .filter((field) => field.headquarters && !seededFields.has(field.fieldName))
    .map((field) => {
      const id = headquartersIdFor(field.fieldName, field.headquarters);
      return {
        id,
        createdAt: field.createdAt,
        instagram: null,
        site: null,
        youtube: null,
        tiktok: null,
        facebook: null,
        contact: null,
        street: null,
        number: null,
        city: null,
        state: field.state,
        country: "Brasil",
        neighborhood: null,
        show: true,
        cnpj: null,
        paymentTokenOne: null,
        paymentTokenTwo: null,
        regionalName: null,
        fieldName: field.fieldName,
        churchName: field.headquarters,
        linkedHeadquartersId: id,
        agendaPdf: null,
        pix: null,
        bank: null,
      };
    });

  return [...seededHeadquarters, ...derivedHeadquarters];
};

const buildLegacyRegionals = (headquartersByField) => {
  const seen = new Set();

  return legacyChurchSeeds.reduce((items, church) => {
    const key = `${church.fieldName}::${church.regionalName}`;
    if (seen.has(key)) {
      return items;
    }

    seen.add(key);
    items.push({
      id: legacyRegionId(church.fieldName, church.regionalName),
      regionalName: church.regionalName,
      headquartersId: headquartersByField.get(church.fieldName)?.id ?? null,
      fieldName: church.fieldName,
    });
    return items;
  }, []);
};

const extractChurchCode = (churchName) => {
  const [prefix] = churchName.split(" - ");
  return prefix && prefix !== churchName ? prefix : toCode(churchName);
};

async function seedLegacyOrganization() {
  const currentFields = await prisma.campo.findMany({ select: { id: true, name: true, code: true } });
  const currentFieldIdByKey = new Map(
    currentFields.flatMap((item) => [
      [normalizeLookupKey(item.name), item.id],
      [normalizeLookupKey(item.code), item.id],
    ])
  );

  const legacyHeadquarters = buildLegacyHeadquarters();
  const headquartersByField = new Map(legacyHeadquarters.map((item) => [item.fieldName, item]));
  const legacyRegionals = buildLegacyRegionals(headquartersByField);
  const regionalIdByKey = new Map(
    legacyRegionals.map((item) => [`${item.fieldName}::${item.regionalName}`, item.id])
  );

  await prisma.legacyChurchPhoto.deleteMany();
  await prisma.legacyChurch.deleteMany();
  await prisma.legacyRegional.deleteMany();
  await prisma.legacyChurchHeadquarters.deleteMany();
  await prisma.legacyField.deleteMany();

  await prisma.legacyField.createMany({
    data: legacyFieldSeeds.map((item) => ({
      id: legacyFieldId(item.fieldName),
      createdAt: item.createdAt,
      state: item.state,
      fieldName: item.fieldName,
      president: item.president,
      headquarters: item.headquarters,
      password: item.password,
    })),
  });

  await prisma.legacyChurchHeadquarters.createMany({
    data: legacyHeadquarters.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      fieldId: currentFieldIdByKey.get(normalizeLookupKey(item.fieldName)),
      instagram: item.instagram,
      site: item.site,
      youtube: item.youtube,
      tiktok: item.tiktok,
      facebook: item.facebook,
      contact: item.contact,
      street: item.street,
      number: item.number,
      city: item.city,
      state: item.state,
      country: item.country,
      neighborhood: item.neighborhood,
      show: item.show,
      cnpj: item.cnpj,
      paymentTokenOne: item.paymentTokenOne,
      paymentTokenTwo: item.paymentTokenTwo,
      regionalName: item.regionalName,
      fieldName: item.fieldName,
      churchName: item.churchName,
      linkedHeadquartersId: item.linkedHeadquartersId || null,
      agendaPdf: item.agendaPdf,
      pix: item.pix,
      bank: item.bank,
    })),
  });

  await prisma.legacyRegional.createMany({
    data: legacyRegionals.map((item) => ({
      id: item.id,
      fieldId: currentFieldIdByKey.get(normalizeLookupKey(item.fieldName)),
      regionalName: item.regionalName,
      headquartersId: item.headquartersId,
      fieldName: item.fieldName,
    })),
  });

  await prisma.legacyChurch.createMany({
    data: legacyChurchSeeds.map((item, index) => {
      const headquarters = headquartersByField.get(item.fieldName);
      const isHeadquartersChurch = headquarters?.churchName === item.churchName;

      return {
        id: legacyChurchId(item.fieldName, item.regionalName, item.churchName),
        churchName: item.churchName,
        fieldId: currentFieldIdByKey.get(normalizeLookupKey(item.fieldName)),
        regionalId: regionalIdByKey.get(`${item.fieldName}::${item.regionalName}`) ?? null,
        headquartersId: headquarters ? headquarters.id : null,
        hierarchy: null,
        documentType: "CNPJ",
        documentNumber: item.documentNumber,
        foundationDate: null,
        zipcode: null,
        country: null,
        state: null,
        city: null,
        neighborhood: null,
        street: null,
        regionalName: item.regionalName,
        hasOwnTemple: null,
        fieldName: item.fieldName,
        firebaseId: null,
        notes: null,
        parentChurch: isHeadquartersChurch ? null : headquarters?.churchName ?? null,
        isActive: true,
        code: null,
        plateName: null,
        leader: null,
        entry: null,
        exit: null,
        leaderRoll: null,
      };
    }),
  });
}

async function seedCurrentOrganization() {
  const fieldStateByName = new Map(legacyFieldSeeds.map((item) => [item.fieldName, item.state]));
  const currentFieldSeeds = await Promise.all(
    legacyFieldSeeds.map(async (item) => ({
      name: toDisplayName(item.fieldName),
      code: toCode(item.fieldName),
      country: "Brasil",
      accessPasswordHash: item.password ? await bcrypt.hash(item.password, 12) : null,
    }))
  );

  const regionalSeeds = [];
  const seenRegionals = new Set();
  for (const church of legacyChurchSeeds) {
    const key = `${church.fieldName}::${church.regionalName}`;
    if (seenRegionals.has(key)) {
      continue;
    }

    seenRegionals.add(key);
    regionalSeeds.push({
      fieldName: church.fieldName,
      code: toCode(church.regionalName),
      name: /^\d+$/.test(church.regionalName)
        ? `Regional ${church.regionalName.padStart(2, "0")}`
        : toDisplayName(church.regionalName),
      state: fieldStateByName.get(church.fieldName) ?? null,
      city: toDisplayName(church.fieldName),
    });
  }

  await prisma.churchLeaderHistory.deleteMany();
  await prisma.churchFunctionHistory.deleteMany();
  await prisma.churchContact.deleteMany();
  await prisma.church.deleteMany();
  await prisma.regional.deleteMany();
  await prisma.campo.deleteMany();

  await prisma.campo.createMany({ data: currentFieldSeeds });

  const currentFields = await prisma.campo.findMany();
  const currentFieldIdByCode = new Map(currentFields.map((item) => [item.code, item.id]));

  await prisma.regional.createMany({
    data: regionalSeeds.map((item) => ({
      campoId: currentFieldIdByCode.get(toCode(item.fieldName)),
      name: item.name,
      code: item.code,
      state: item.state,
      city: item.city,
    })),
  });

  const currentRegionals = await prisma.regional.findMany();
  const currentRegionalIdByKey = new Map(
    currentRegionals.map((item) => [`${item.campoId}::${item.code}`, item.id])
  );

  await prisma.church.createMany({
    data: legacyChurchSeeds.map((item) => {
      const campoId = currentFieldIdByCode.get(toCode(item.fieldName));

      return {
        regionalId: currentRegionalIdByKey.get(`${campoId}::${toCode(item.regionalName)}`),
        name: item.churchName,
        code: extractChurchCode(item.churchName),
        legalName: item.churchName,
        cnpj: null,
        documentType: "CNPJ",
        documentNumber: item.documentNumber,
        hasOwnTemple: false,
        status: "active",
        addressState: fieldStateByName.get(item.fieldName) ?? null,
        addressCountry: "Brasil",
      };
    }),
  });

  await prisma.churchFunctionCatalog.deleteMany();
  await prisma.churchFunctionCatalog.createMany({
    data: churchFunctionSeeds.map((name, index) => ({
      name,
      abbreviation: name.slice(0, 20),
      isActive: true,
      displayOrder: BigInt(index + 1),
      requiresMinimumDate: false,
      isLeaderRole: name.includes("DIRIGENTE") || name.includes("PASTOR"),
      isBoardRole: name.includes("SECRETARIO") || name.includes("TESOUREIRO"),
      onlyMinister: false,
      allowMen: true,
      allowWomen: true,
    })),
  });
}

async function seed() {
  await seedCurrentOrganization();
  await seedLegacyOrganization();

  const adminEmail = "admin@mrm.church";
  const existing = await prisma.user.findFirst({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash("Admin@123", 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: "Administrador MRM",
        profileType: "master",
        isAdmin: true,
        isActive: true,
      },
    });
    console.log("Admin user created: admin@mrm.church / Admin@123");
  }
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

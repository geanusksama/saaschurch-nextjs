import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function handleGetInner(user: any, sp: URLSearchParams) {
    const q = (sp.get("q") ?? "").trim();
    const rolParam = sp.get("rol") ?? "";
    const de = sp.get("de") ?? "";
    const ate = sp.get("ate") ?? "";
    const campoParam = sp.get("campo") ?? "";
    const churchIdParam = sp.get("churchId") ?? "";

    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize")) || 20), 100);

    console.log("DEBUG: face-presence GET params:", { q, rolParam, de, ate, churchIdParam, campoParam, page, pageSize });
    console.log("DEBUG: face-presence GET user:", { email: user.email, profileType: user.profileType, campoId: user.campoId, churchId: user.churchId });

    const filterConditions: any[] = [];


    // Filter by name/search query
    if (q) {
      filterConditions.push({
        OR: [
          { nome: { contains: q, mode: "insensitive" } },
          { cargo: { contains: q, mode: "insensitive" } },
          { camera: { contains: q, mode: "insensitive" } },
          { igrejaRegional: { contains: q, mode: "insensitive" } }
        ],
      });
    }

    // Filter by exact ROL if provided
    if (rolParam) {
      const parsedRol = Number(rolParam);
      if (Number.isInteger(parsedRol)) {
        filterConditions.push({ rol: parsedRol });
      }
    }

    // Filter by start date (de)
    if (de) {
      filterConditions.push({ horario: { gte: new Date(de) } });
    }

    // Filter by end date (ate)
    if (ate) {
      filterConditions.push({ horario: { lte: new Date(ate) } });
    }

    // Isolate by user's campoId if they are not master
    if (user.profileType !== "master") {
      if (!user.campoId) {
        throw new Error("Sem acesso. Campo não definido.");
      }
      const conditions: any[] = [{ campo: user.campoId }];
      if (user.campoName) {
        conditions.push({ campo: user.campoName });
      }
      filterConditions.push({ OR: conditions });
    } else if (campoParam) {
      filterConditions.push({ campo: campoParam });
    }

    // Isolate by churchId
    const isRestricted = user.profileType === "church" || 
      (user.roleName && (() => {
        const name = String(user.roleName).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return name.includes("secret") || name.includes("tesour");
      })());

    if (isRestricted) {
      if (!user.churchId) {
        throw new Error("Sem acesso. Igreja não definida.");
      }
      let ownChurchName = "";
      const ownChurch = await prisma.church.findUnique({
        where: { id: user.churchId },
        select: { name: true }
      });
      if (ownChurch) ownChurchName = ownChurch.name;
      const cleanName = ownChurchName.replace("AD ", "").split("-")[0].trim();
      if (cleanName) {
        filterConditions.push({
          OR: [
            { churchId: user.churchId },
            {
              AND: [
                { churchId: null },
                { igrejaRegional: { contains: cleanName, mode: "insensitive" } }
              ]
            }
          ]
        });
      } else {
        filterConditions.push({ churchId: user.churchId });
      }
    } else if (churchIdParam && churchIdParam !== "all") {
      let churchName = "";
      const church = await prisma.church.findUnique({
        where: { id: churchIdParam },
        select: { name: true }
      });
      if (church) churchName = church.name;
      const cleanName = churchName.replace("AD ", "").split("-")[0].trim();
      if (cleanName) {
        filterConditions.push({
          OR: [
            { churchId: churchIdParam },
            {
              AND: [
                { churchId: null },
                { igrejaRegional: { contains: cleanName, mode: "insensitive" } }
              ]
            }
          ]
        });
      } else {
        filterConditions.push({ churchId: churchIdParam });
      }
    }

    const where = filterConditions.length > 0 ? { AND: filterConditions } : {};

    const skip = (page - 1) * pageSize;

    // Get paginated records, ordered by latest detection
    const [records, total] = await Promise.all([
      prisma.facePresenca.findMany({
        where,
        orderBy: { horario: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.facePresenca.count({ where }),
    ]);

    // Calculate report statistics based on the active filters
    const [recognizedCount, unrecognizedCount, totalSent] = await Promise.all([
      prisma.facePresenca.count({
        where: {
          ...where,
          rol: { not: null },
        },
      }),
      prisma.facePresenca.count({
        where: {
          ...where,
          rol: null,
        },
      }),
      prisma.facePresenca.count({
        where,
      }),
    ]);

    // Find the latest session/timestamp for display (Image 2's Sessão indicator)
    const latestRecord = await prisma.facePresenca.findFirst({
      orderBy: { horario: "desc" },
      select: { horario: true }
    });

    let activeSession = "";
    if (latestRecord) {
      const date = new Date(latestRecord.horario);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      activeSession = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    }

    return {
      data: records,
      total,
      recognizedCount,
      unrecognizedCount,
      totalSent,
      activeSession,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const sp = new URL(req.url).searchParams;
      const result = await handleGetInner(user, sp);
      return NextResponse.json(result);
    } catch (err: any) {
      console.error("DEBUG: GET error details:", err);
      return NextResponse.json({ error: err.message || "Erro interno do servidor" }, { status: 500 });
    }
  });
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rol, nome, cargo, horario, confianca, camera, igreja_regional, campo, church_id, churchId } = body;

    if (!nome) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const newRecord = await prisma.facePresenca.create({
      data: {
        rol: rol ? Number(rol) : null,
        nome,
        cargo: cargo || null,
        horario: horario ? new Date(horario) : new Date(),
        confianca: confianca !== undefined ? Number(confianca) : null,
        camera: camera || null,
        igrejaRegional: igreja_regional || null,
        campo: campo || null,
        churchId: church_id || churchId || null,
      },
    });

    return NextResponse.json(newRecord, { status: 201 });
  } catch (err) {
    console.error("Erro ao criar face presenca:", err);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

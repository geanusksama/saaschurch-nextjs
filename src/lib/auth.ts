/**
 * Auth helpers para Next.js Route Handlers
 * Adaptado do server/auth.js do Fastify
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";
import { prisma } from "./prisma";

export interface AuthUser {
  id: string | null;
  sub: string;
  email: string | undefined;
  fullName: string;
  profileType: string;
  churchId: string | null;
  churchName: string | null;
  regionalId: string | null;
  regionalName: string | null;
  campoId: string | null;
  campoName: string | null;
  roleId: string | null;
  roleName: string | null;
  permissions: unknown;
  isAdmin: boolean;
  parentChurchId: string | null;
  parentChurch: unknown;
  headquartersId: string | null;
  headquartersName: string | null;
  headquarters: unknown;
  profile: unknown;
}

function normalizeRoleName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isRestrictedToOwnChurch(user: AuthUser) {
  if (user.profileType === "church") return true;
  const normalizedRoleName = normalizeRoleName(String(user.roleName || ""));
  return normalizedRoleName.includes("secret") || normalizedRoleName.includes("tesour");
}

async function loadUserProfileByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: {
      role: { select: { id: true, name: true, permissions: true, churchId: true } },
      campo: { select: { id: true, name: true, code: true } },
      regional: {
        select: {
          id: true, name: true, code: true, campoId: true,
          campo: { select: { id: true, name: true, code: true } },
        },
      },
      church: {
        select: {
          id: true, name: true, code: true, regionalId: true, parentChurchId: true,
          regional: {
            select: {
              id: true, name: true, code: true, campoId: true,
              campo: { select: { id: true, name: true, code: true } },
            },
          },
          parentChurch: { select: { id: true, name: true, code: true } },
        },
      },
    },
  }).catch(() => null);
}

async function loadFieldHeadquarters(campoId: string | null) {
  if (!campoId) return null;
  return prisma.legacyChurchHeadquarters.findFirst({
    where: { fieldId: campoId },
    orderBy: [{ show: "desc" }, { churchName: "asc" }],
    select: {
      id: true, fieldId: true, fieldName: true, churchName: true,
      regionalName: true, city: true, state: true, contact: true,
    },
  }).catch(() => null);
}

async function ensureUserProfile(authUser: { id: string; email?: string; user_metadata?: Record<string, string> }) {
  const metadata = authUser.user_metadata || {};
  if (!authUser.email) return null;
  let profile = await loadUserProfileByEmail(authUser.email);
  if (profile) return profile;

  const initialProfileType = metadata.profile_type || "pending";
  await prisma.user.create({
    data: {
      email: authUser.email,
      fullName: metadata.full_name || authUser.email,
      phone: metadata.phone || null,
      profileType: initialProfileType,
      churchId: metadata.church_id || null,
      campoId: metadata.campo_id || null,
      roleId: metadata.role_id || null,
      isAdmin: initialProfileType === "master" || initialProfileType === "admin",
    },
  }).catch(() => null);

  return loadUserProfileByEmail(authUser.email);
}

/**
 * Extrai e valida o Bearer token. Retorna o AuthUser ou lança NextResponse 401.
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) throw NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const authUser = data.user;
  const profile = await ensureUserProfile(authUser);

  const scopedChurch = profile?.church || null;
  const scopedRegional = profile?.regional || scopedChurch?.regional || null;
  const scopedCampo = profile?.campo || scopedRegional?.campo || null;
  const effectiveCampoId = profile?.campoId || scopedRegional?.campoId || null;
  const fieldHeadquarters = await loadFieldHeadquarters(effectiveCampoId);

  return {
    id: profile?.id || null,
    sub: authUser.id,
    email: authUser.email,
    fullName: profile?.fullName || authUser.user_metadata?.full_name || authUser.email || "",
    profileType: profile?.profileType || authUser.user_metadata?.profile_type || "church",
    churchId: profile?.churchId || null,
    churchName: scopedChurch?.name || null,
    regionalId: scopedRegional?.id || null,
    regionalName: scopedRegional?.name || null,
    campoId: effectiveCampoId,
    campoName: scopedCampo?.name || null,
    roleId: profile?.roleId || null,
    roleName: profile?.role?.name || null,
    permissions: profile?.permissions || profile?.role?.permissions || null,
    isAdmin: profile?.isAdmin || false,
    parentChurchId: scopedChurch?.parentChurchId || null,
    parentChurch: scopedChurch?.parentChurch || null,
    headquartersId: fieldHeadquarters?.id || null,
    headquartersName: fieldHeadquarters?.churchName || null,
    headquarters: fieldHeadquarters,
    profile,
  };
}

/**
 * Wrapper para route handlers que precisam de autenticação.
 * Uso: return withAuth(req, async (user) => { ... })
 */
export async function withAuth(
  req: NextRequest,
  handler: (user: AuthUser) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const user = await getAuthUser(req);
    return await handler(user);
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error("[auth]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

/**
 * Wrapper para route handlers com checagem de perfil.
 */
export function withProfile(...allowedProfiles: string[]) {
  return function (req: NextRequest, handler: (user: AuthUser) => Promise<NextResponse>) {
    return withAuth(req, async (user) => {
      if (!allowedProfiles.includes(user.profileType)) {
        return NextResponse.json({ error: "Acesso negado. Perfil insuficiente." }, { status: 403 });
      }
      return handler(user);
    });
  };
}

/**
 * Retorna filtro Prisma baseado no escopo do usuário.
 */
export function scopeFilter(user: AuthUser): Record<string, unknown> {
  if (user.profileType === "master" || user.profileType === "admin") return {};
  if (isRestrictedToOwnChurch(user) && user.churchId) return { churchId: user.churchId };
  return {};
}

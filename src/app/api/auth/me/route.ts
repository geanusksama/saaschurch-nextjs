import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

function serializeBigInts(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  ));
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profile) {
      return NextResponse.json(serializeBigInts(user.profile));
    }
    return NextResponse.json(serializeBigInts({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      profileType: user.profileType,
      churchId: user.churchId,
      churchName: user.churchName,
      regionalId: user.regionalId,
      regionalName: user.regionalName,
      campoId: user.campoId,
      campoName: user.campoName,
      roleId: user.roleId,
      roleName: user.roleName,
      permissions: user.permissions,
      isAdmin: user.isAdmin,
      headquartersId: user.headquartersId,
      headquartersName: user.headquartersName,
    }));
  });
}

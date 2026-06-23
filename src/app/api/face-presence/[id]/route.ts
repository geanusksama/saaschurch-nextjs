import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return withAuth(req, async (user) => {
    try {
      // 1. Fetch existing presence record to check permissions
      const existingRecord = await prisma.facePresenca.findUnique({
        where: { id }
      });

      if (!existingRecord) {
        return NextResponse.json({ error: "Registro de presença não encontrado." }, { status: 404 });
      }

      // 2. Permission checks based on user profile
      if (user.profileType === "church") {
        // Restricted to their own church
        if (existingRecord.churchId && existingRecord.churchId !== user.churchId) {
          return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }
      } else if (user.profileType === "campo") {
        // Restricted to their own campo
        const matchesCampo = (existingRecord.campo === user.campoId) || (existingRecord.campo === user.campoName);
        if (existingRecord.campo && !matchesCampo) {
          return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }
      }

      // 3. Delete from DB
      await prisma.facePresenca.delete({
        where: { id }
      });

      return NextResponse.json({ success: true, message: "Registro de presença removido com sucesso." });
    } catch (err: any) {
      console.error("DEBUG: Error deleting FaceID presence record:", err);
      return NextResponse.json({ error: err.message || "Erro ao remover registro de presença." }, { status: 500 });
    }
  });
}

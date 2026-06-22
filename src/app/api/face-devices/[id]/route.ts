import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { serial, name, username, password, churchId } = body;

      // 1. Fetch existing device to verify existence and check permissions
      const existingDevice = await prisma.faceidDevice.findUnique({
        where: { id },
        include: { church: true }
      });

      if (!existingDevice) {
        return NextResponse.json({ error: "Dispositivo não encontrado." }, { status: 404 });
      }

      // Check user permissions against the device's tenant scope
      if (user.profileType === "church" && existingDevice.churchId !== user.churchId) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }

      // Check user permissions against target churchId if changes are being made
      if (churchId && user.profileType === "church" && churchId !== user.churchId) {
        return NextResponse.json({ error: "Acesso negado. Você só pode associar o dispositivo à sua própria igreja." }, { status: 403 });
      }

      const updatedDevice = await prisma.faceidDevice.update({
        where: { id },
        data: {
          serial: serial !== undefined ? String(serial).trim() : undefined,
          name: name !== undefined ? String(name).trim() : undefined,
          username: username !== undefined ? (username ? String(username).trim() : null) : undefined,
          password: password !== undefined ? (password ? String(password).trim() : null) : undefined,
          churchId: churchId || undefined
        }
      });

      return NextResponse.json(updatedDevice);
    } catch (err: any) {
      console.error("DEBUG: Error updating FaceID device:", err);
      if (err.code === "P2002") {
        return NextResponse.json({ error: "Já existe um dispositivo cadastrado com este ID/Serial." }, { status: 400 });
      }
      return NextResponse.json({ error: err.message || "Erro ao atualizar dispositivo." }, { status: 500 });
    }
  });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return withAuth(req, async (user) => {
    try {
      // 1. Fetch existing device to verify ownership/tenancy
      const existingDevice = await prisma.faceidDevice.findUnique({
        where: { id }
      });

      if (!existingDevice) {
        return NextResponse.json({ error: "Dispositivo não encontrado." }, { status: 404 });
      }

      if (user.profileType === "church" && existingDevice.churchId !== user.churchId) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }

      await prisma.faceidDevice.delete({
        where: { id }
      });

      return NextResponse.json({ success: true, message: "Dispositivo removido com sucesso." });
    } catch (err: any) {
      console.error("DEBUG: Error deleting FaceID device:", err);
      return NextResponse.json({ error: err.message || "Erro ao remover dispositivo." }, { status: 500 });
    }
  });
}

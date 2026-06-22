import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log("DEBUG: Notifications DAO received payload:", JSON.stringify(payload));

    if (!payload || !payload.object_changes || !payload.object_changes[0]) {
      return NextResponse.json({ status: "error", message: "Payload inválido" }, { status: 400 });
    }

    const obj = payload.object_changes[0];
    const values = obj.values;

    if (!values) {
      return NextResponse.json({ status: "error", message: "Valores ausentes no payload" }, { status: 400 });
    }

    const logId = Number(values.id);
    const timestamp = Number(values.time);
    const event = Number(values.event);
    const userId = Number(values.user_id);
    const portalId = Number(values.portal_id || 0);
    const deviceId = String(values.device_id);

    // Convert Unix timestamp (seconds) to JavaScript Date
    const timeLog = new Date(timestamp * 1000);

    // 1. Identify the registered device to map to a specific church
    const device = await prisma.faceidDevice.findUnique({
      where: { serial: deviceId },
      include: { church: true }
    });

    // 2. Look up member in members table by ROL or CPF
    const member = await prisma.member.findFirst({
      where: {
        OR: [
          { rol: userId },
          { cpf: String(userId) }
        ]
      },
      include: {
        church: true,
        ecclesiasticalTitleRef: true
      }
    });

    if (!member) {
      console.log(`DEBUG: Member not found for ROL/CPF: ${userId}`);
      return NextResponse.json({ status: "error", message: "Membro não encontrado" }, { status: 404 });
    }

    // Resolve tenancy information: prefer the device's church, fallback to the member's church
    const finalChurchId = device?.churchId || member.churchId;
    const finalChurchName = device?.church?.name || member.church?.name || "—";
    
    // Resolve Campo ID/Name (stored in the presence table's 'campo' field)
    const finalCampo = member.campoId || null;
    const cargoName = member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle || "Membro";

    // 3. Save the presence log to face_presencas table
    const newRecord = await prisma.facePresenca.create({
      data: {
        rol: member.rol,
        nome: member.fullName,
        cargo: cargoName,
        horario: timeLog,
        confianca: 1.0, // Face ID authenticated successfully at the physical reader
        camera: device?.name || `Dispositivo ${deviceId} (Portal ${portalId})`,
        igrejaRegional: finalChurchName,
        campo: finalCampo,
        churchId: finalChurchId
      }
    });

    console.log("DEBUG: Face ID presence saved successfully:", newRecord);

    // Return the response contract matching the Flask implementation
    return NextResponse.json({
      status: "success",
      user: member.fullName,
      cpf: member.cpf || "",
      cargo: cargoName,
      igreja: finalChurchName
    }, { status: 200 });

  } catch (err: any) {
    console.error("DEBUG: Error in notifications/dao processing:", err);
    return NextResponse.json({ status: "error", message: err.message || "Erro interno do servidor" }, { status: 500 });
  }
}

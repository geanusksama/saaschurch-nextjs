import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { AuthUser } from "./auth";

export async function logMutationAudit(
  req: NextRequest,
  user: AuthUser,
  res: NextResponse
) {
  try {
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;

    // We only log successful mutations (status code 2xx)
    if (res.status < 200 || res.status >= 300) {
      return;
    }

    let responseData: any = null;
    try {
      const cloned = res.clone();
      responseData = await cloned.json();
    } catch {
      // Ignore (e.g. status 204 No Content has no body)
    }

    let requestData: any = null;
    try {
      const clonedReq = req.clone();
      requestData = await clonedReq.json();
    } catch {
      // Ignore
    }

    let actionType: "create" | "update" | "delete" | "read" | "auth" | "system" = "system";
    if (method === "POST") actionType = "create";
    else if (method === "PATCH" || method === "PUT") actionType = "update";
    else if (method === "DELETE") actionType = "delete";

    let entityType = "Outro";
    let description = "";
    let resourceName = "";
    let entityId: string | null = null;

    // Detect path-based entity type and detail description
    if (path.includes("/api/members")) {
      entityType = "Member";
      resourceName = responseData?.fullName || requestData?.fullName || "Membro";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criou novo membro" : method === "DELETE" ? "Deletou membro" : "Atualizou membro";
    } else if (path.includes("/api/churches")) {
      entityType = "Church";
      resourceName = responseData?.name || requestData?.name || "Igreja";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criou nova igreja" : method === "DELETE" ? "Deletou igreja" : "Atualizou igreja";
    } else if (path.includes("/api/regionais")) {
      entityType = "Regional";
      resourceName = responseData?.name || requestData?.name || "Regional";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criou nova regional" : method === "DELETE" ? "Deletou regional" : "Atualizou regional";
    } else if (path.includes("/api/campos")) {
      entityType = "Campo";
      resourceName = responseData?.name || requestData?.name || "Campo";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criou novo campo" : method === "DELETE" ? "Deletou campo" : "Atualizou campo";
    } else if (path.includes("/api/users")) {
      entityType = "User";
      resourceName = responseData?.fullName || responseData?.email || requestData?.fullName || requestData?.email || "Usuário";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criou novo usuário" : method === "DELETE" ? "Deletou usuário" : "Atualizou usuário";
    } else if (path.includes("/api/roles") || path.includes("/api/permissions")) {
      entityType = "Role";
      resourceName = responseData?.name || requestData?.name || "Função/Perfil";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criou nova função/permissões" : method === "DELETE" ? "Deletou função" : "Atualizou função/permissões";
    } else if (path.includes("/api/ebd/estoque")) {
      entityType = "EbdEstoque";
      resourceName = responseData?.produto?.nome || requestData?.produtoNome || "Estoque EBD";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Adicionou produto ao estoque EBD" : "Atualizou estoque EBD";
    } else if (path.includes("/api/ebd/entregas")) {
      entityType = "EbdEntrega";
      resourceName = responseData?.alunoNome || requestData?.alunoNome || "Entrega EBD";
      entityId = responseData?.id || requestData?.id || null;
      description = "Registrou entrega EBD";
    } else if (path.includes("/api/ebd")) {
      entityType = "EBD";
      resourceName = responseData?.nome || requestData?.nome || "Módulo EBD";
      entityId = responseData?.id || requestData?.id || null;
      description = `Ação EBD: ${method}`;
    } else if (path.includes("/api/finance")) {
      entityType = "Finance";
      resourceName = responseData?.description || requestData?.description || "Movimentação Financeira";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Lançou movimentação financeira" : method === "DELETE" ? "Deletou lançamento financeiro" : "Atualizou lançamento financeiro";
    } else if (path.includes("/api/events")) {
      entityType = "Event";
      resourceName = responseData?.title || requestData?.title || "Evento";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criou novo evento" : method === "DELETE" ? "Deletou evento" : "Atualizou evento";
    } else if (path.includes("/api/ministries")) {
      entityType = "Ministry";
      resourceName = responseData?.name || requestData?.name || "Ministério";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criou novo ministério" : method === "DELETE" ? "Deletou ministério" : "Atualizou ministério";
    } else if (path.includes("/api/cell-groups")) {
      entityType = "CellGroup";
      resourceName = responseData?.name || requestData?.name || "Grupo Familiar (Célula)";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criou novo grupo familiar" : method === "DELETE" ? "Deletou grupo familiar" : "Atualizou grupo familiar";
    } else if (path.includes("/api/whatsapp")) {
      entityType = "WhatsApp";
      resourceName = responseData?.name || requestData?.name || "WhatsApp";
      entityId = responseData?.id || requestData?.id || null;
      description = method === "POST" ? "Criação de instância/campanha" : "Atualização de WhatsApp";
    } else if (path.includes("/api/chat")) {
      entityType = "Chat";
      resourceName = "Mensagem de Chat";
      description = "Enviou mensagem no chat";
    } else if (path.includes("/api/settings") || path.includes("/api/system-settings")) {
      entityType = "Setting";
      resourceName = responseData?.settingKey || requestData?.settingKey || "Configurações";
      description = "Atualizou configurações do sistema";
    }

    if (!description) {
      description = `${method} em ${path}`;
    }
    if (!resourceName) {
      resourceName = path;
    }

    const ipAddress = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0].trim();
    const userAgent = req.headers.get("user-agent") || undefined;

    await prisma.auditLog.create({
      data: {
        userId: user.id || null,
        churchId: user.churchId || null,
        action: actionType, // 'create' | 'update' | 'delete' etc.
        entityType: resourceName.substring(0, 100),
        entityId: entityId || null,
        description: description,
        changes: requestData ? requestData : null,
        ipAddress: ipAddress.substring(0, 45),
        userAgent: userAgent || null,
      },
    });
  } catch (e) {
    console.error("[logMutationAudit] Error saving audit log:", e);
  }
}

export async function logManualAudit(
  req: NextRequest | null,
  userId: string | null,
  churchId: string | null,
  actionType: "create" | "update" | "delete" | "read" | "auth" | "system",
  description: string,
  resourceName: string,
  entityId?: string,
  changes?: any
) {
  try {
    const ipAddress = req
      ? (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0].trim()
      : "Sistema";
    const userAgent = req ? req.headers.get("user-agent") || undefined : undefined;

    await prisma.auditLog.create({
      data: {
        userId,
        churchId,
        action: actionType,
        entityType: resourceName.substring(0, 100),
        entityId: entityId || null,
        description,
        changes: changes || null,
        ipAddress: ipAddress.substring(0, 45),
        userAgent: userAgent || null,
      },
    });
  } catch (e) {
    console.error("[logManualAudit] Error saving audit log:", e);
  }
}

import { apiBase } from "./apiBase";

export async function logClientAudit(
  actionType: "create" | "update" | "delete" | "read" | "auth" | "system",
  description: string,
  resourceName: string,
  entityId?: string | null,
  changes?: any
) {
  const token = localStorage.getItem("mrm_token");
  if (!token) return;
  try {
    await fetch(`${apiBase}/audit-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        actionType,
        description,
        resourceName,
        entityId: entityId || null,
        changes: changes || null
      })
    });
  } catch (err) {
    console.error("[logClientAudit] Failed to send client audit log:", err);
  }
}

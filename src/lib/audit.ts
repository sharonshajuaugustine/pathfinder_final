import "server-only";
import { getServiceClient } from "@/lib/supabase/admin";

// Append-only audit logging for compliance (DPDP). Best-effort: never throws
// into the request path.
export async function audit(entry: {
  actorType?: "system" | "admin" | "counsellor" | "student";
  actorId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ipHash?: string;
}): Promise<void> {
  try {
    await getServiceClient().from("audit_log").insert({
      actor_type: entry.actorType ?? "system",
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      meta: entry.meta ?? {},
      ip_hash: entry.ipHash ?? null,
    });
  } catch (e) {
    console.error("audit_log insert failed", e);
  }
}

import { FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "./admin";

/**
 * Server-side audit trail (river-ai-rules C0h): shops/{shopId}/audit_logs/{autoId}
 * { actor, action, resource, resourceId, at }. Written in the same transaction as the mutation; no PII.
 * Owners can read their shop's log; no client writes (see firestore.rules).
 */
export function auditInTx(tx: Transaction, shopId: string, actor: string, action: string, resource: DocumentReference) {
  const ref = adminDb().collection("shops").doc(shopId).collection("audit_logs").doc();
  tx.create(ref, { actor, action, resource: resource.parent.id, resourceId: resource.id, at: FieldValue.serverTimestamp() });
}

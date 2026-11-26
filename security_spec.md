# Security Specification — Vértice CRM

## 1. Data Invariants

1. **Strict Multi-Tenant PII Isolation**: Every document in `/users/{userId}`, `/leads/{leadId}`, `/leads/{leadId}/interactions/{interactionId}`, and `/tasks/{taskId}` belongs to a single verified user (`ownerId == request.auth.uid` and `request.auth.token.email_verified == true`). No user can read, list, create, update, or delete another user's records.
2. **Relational Parent Integrity**:
   - An `Interaction` at `/leads/{leadId}/interactions/{interactionId}` can only be created or accessed if `/leads/{leadId}` exists and is owned by `request.auth.uid`, and `interaction.leadId == leadId`.
   - A `FollowUpTask` at `/tasks/{taskId}` can only be created if `/leads/{incoming().leadId}` exists and is owned by `request.auth.uid`.
3. **Immutability & Temporal Integrity**:
   - `ownerId`, `createdAt`, `createdMonth` (on leads), and `leadId` (on tasks/interactions) are immutable after creation.
   - `createdAt` and `updatedAt` must equal `request.time` (server timestamps).
4. **Terminal State Locking**:
   - Once a `FollowUpTask` reaches `status == 'concluida'`, no further updates are permitted (preventing tampering with completed follow-up history).
5. **Volumetric & Schema Guarding**:
   - All document IDs match `^[a-zA-Z0-9_\-]+$` and are `<= 128` chars.
   - All string fields enforce explicit `.size()` bounds matching `firebase-blueprint.json`.
   - No undeclared/shadow fields are allowed on create (`hasOnly`) or update (`affectedKeys().hasOnly`).

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Malicious Payload / Condition | Expected Result |
|---|---------------|-------------|-------------------------------|-----------------|
| 1 | **Identity Spoofing on Create** | `/leads/lead-1` | `ownerId: "victim-uid"` while signed in as `attacker-uid` | `PERMISSION_DENIED` |
| 2 | **Unverified Email Bypass** | `/leads/lead-1` | Valid lead payload with `request.auth.token.email_verified == false` | `PERMISSION_DENIED` |
| 3 | **Shadow / Ghost Field Injection** | `/leads/lead-1` | Valid lead fields + `isAdmin: true` | `PERMISSION_DENIED` |
| 4 | **PII Cross-User Read** | `/leads/victim-lead-1` | `get()` on another user's lead containing `email` and `phone` | `PERMISSION_DENIED` |
| 5 | **Unscoped List Scraping** | `/leads` | `list` query without `where('ownerId', '==', uid)` | `PERMISSION_DENIED` |
| 6 | **Document ID Poisoning** | `/leads/<200-char-junk-id>` | Valid lead written to oversized/invalid ID path | `PERMISSION_DENIED` |
| 7 | **Oversized String Exhaustion** | `/leads/lead-1` | `notes` string with 5,000 characters (limit 1,000) | `PERMISSION_DENIED` |
| 8 | **Client Timestamp Forgery** | `/leads/lead-1` | `createdAt` set to past date instead of `serverTimestamp()` | `PERMISSION_DENIED` |
| 9 | **Immutable Field Tampering** | `/leads/lead-1` | `update()` changing `ownerId` or `createdMonth` | `PERMISSION_DENIED` |
| 10 | **Orphaned Subcollection Write** | `/leads/nonexistent/interactions/int-1` | Create interaction under a lead that does not exist or belongs to another user | `PERMISSION_DENIED` |
| 11 | **Orphaned Follow-Up Task** | `/tasks/task-1` | Create task referencing `leadId` owned by another user | `PERMISSION_DENIED` |
| 12 | **Terminal State Unlock** | `/tasks/done-task-1` | `update()` changing a `'concluida'` task back to `'pendente'` | `PERMISSION_DENIED` |

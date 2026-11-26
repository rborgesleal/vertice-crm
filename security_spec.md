# Security Specification — Vértice CRM (Pipeline, Pedidos & Estoque)

## 1. Data Invariants

1. **Strict Multi-Tenant PII Isolation**: Every document in `/users/{userId}`, `/leads/{leadId}`, `/leads/{leadId}/interactions/{interactionId}`, `/tasks/{taskId}`, `/products/{productId}`, `/stockMovements/{movementId}`, and `/orders/{orderId}` belongs to a single verified user (`ownerId == request.auth.uid` and `request.auth.token.email_verified == true`).
2. **Relational Parent Integrity**:
   - An `Interaction` can only be created/accessed if its parent `/leads/{leadId}` exists and belongs to `request.auth.uid`.
   - A `FollowUpTask` can only be created if its referenced `/leads/{incoming().leadId}` exists and belongs to `request.auth.uid`.
   - A `StockMovement` and an `Order` can only be created if `/products/{incoming().productId}` exists and belongs to `request.auth.uid`.
3. **Atomic Stock Deduction Invariant (Pillar 7 — `getAfter`)**:
   - Creating an `Order` in `/orders/{orderId}` requires that `/products/{productId}` has `stockQuantity >= order.quantity` BEFORE the transaction AND that `getAfter(/products/{productId}).data.stockQuantity == existingStock - order.quantity` AFTER the transaction. An order can never be created without deducting stock atomically.
   - Creating a `StockMovement` verifies arithmetic consistency (`newStock == previousStock + quantity` for `entrada`, or `previousStock - quantity` for `saida`/`saida_pedido`) and matches `getAfter(/products/{productId}).data.stockQuantity == incoming().newStock`.
4. **Immutability & Temporal Integrity**:
   - `ownerId`, `createdAt`, `createdMonth`, `orderMonth`, `leadId` (on tasks/interactions), and order line items (`productId`, `productName`, `quantity`, `unitPrice`, `totalValue`) are immutable after creation.
   - `createdAt` and `updatedAt` must equal `request.time`.
5. **Terminal State Locking**:
   - Once a `FollowUpTask` reaches `status == 'concluida'` or an `Order` reaches `status == 'entregue'`, no subsequent updates are permitted.
6. **Volumetric & Schema Guarding**:
   - All document IDs match `^[a-zA-Z0-9_\-]+$` and are `<= 128` chars.
   - All strings enforce explicit `.size()` bounds matching `firebase-blueprint.json`.
   - Strict `hasAll` / `hasOnly` and `affectedKeys().hasOnly()` prevent shadow fields.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Malicious Payload / Condition | Expected Result |
|---|---------------|-------------|-------------------------------|-----------------|
| 1 | **Identity Spoofing on Create** | `/leads/lead-1` | `ownerId: "victim-uid"` while signed in as `attacker-uid` | `PERMISSION_DENIED` |
| 2 | **Unverified Email Bypass** | `/products/prod-1` | Valid product payload with `email_verified == false` | `PERMISSION_DENIED` |
| 3 | **Shadow / Ghost Field Injection** | `/orders/ord-1` | Valid order fields + `discountOverride: 999` | `PERMISSION_DENIED` |
| 4 | **PII Cross-User Read** | `/leads/victim-lead-1` | `get()` on another user's lead | `PERMISSION_DENIED` |
| 5 | **Unscoped List Scraping** | `/orders` | `list` query without `where('ownerId', '==', uid)` | `PERMISSION_DENIED` |
| 6 | **Document ID Poisoning** | `/products/<200-char-id>` | Valid product written to oversized ID path | `PERMISSION_DENIED` |
| 7 | **Oversized String Exhaustion** | `/leads/lead-1` | `notes` string with 5,000 characters | `PERMISSION_DENIED` |
| 8 | **Client Timestamp Forgery** | `/orders/ord-1` | `createdAt` set to client timestamp instead of `serverTimestamp()` | `PERMISSION_DENIED` |
| 9 | **Order Without Stock Deduction** | `/orders/ord-bypass-1` | Create order without atomically decrementing `/products/{productId}.stockQuantity` | `PERMISSION_DENIED` |
| 10 | **Negative Stock Oversell** | `/orders/ord-oversell-1` | Create order with `quantity: 10` when product only has `stockQuantity: 3` | `PERMISSION_DENIED` |
| 11 | **Orphaned Foreign Product Order** | `/orders/ord-foreign-1` | Create order referencing `productId` owned by another user | `PERMISSION_DENIED` |
| 12 | **Terminal State Unlock** | `/orders/ord-delivered-1` | `update()` changing an `'entregue'` order back to `'pendente'` | `PERMISSION_DENIED` |

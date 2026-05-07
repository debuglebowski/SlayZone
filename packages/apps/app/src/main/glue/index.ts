/**
 * Glue layer fully empty after Phase 2 — all domain event forwarders
 * (agentTurns, gitWatcher) replaced by tRPC subscriptions. Kept as a
 * no-op for now; will be deleted in the preload-teardown commit (P21).
 */
export function wireDomainEvents(): void {}

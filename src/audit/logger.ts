/**
 * Audit logger for admin actions.
 * Records who did what, when, and the outcome.
 * All admin actions are logged for compliance.
 */

interface AuditEntry {
  timestamp: Date;
  userId: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
  outcome: 'success' | 'failure';
  ip: string;
}

const auditLog: AuditEntry[] = [];

/**
 * Log an admin action to the audit trail.
 */
export function logAuditEvent(
  userId: string,
  action: string,
  target: string,
  details: Record<string, unknown>,
  outcome: 'success' | 'failure',
  ip: string,
): void {
  auditLog.push({
    timestamp: new Date(),
    userId,
    action,
    target,
    details,
    outcome,
    ip,
  });
}

/**
 * Retrieve audit entries, optionally filtered.
 */
export function getAuditLog(filters?: {
  userId?: string;
  action?: string;
  since?: Date;
  limit?: number;
}): AuditEntry[] {
  let entries = [...auditLog];

  if (filters?.userId) {
    entries = entries.filter(e => e.userId === filters.userId);
  }
  if (filters?.action) {
    entries = entries.filter(e => e.action === filters.action);
  }
  if (filters?.since) {
    entries = entries.filter(e => e.timestamp >= filters.since);
  }

  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return filters?.limit ? entries.slice(0, filters.limit) : entries;
}

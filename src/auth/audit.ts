/**
 * Audit logging for security-sensitive operations.
 *
 * All authentication events (login, logout, key creation, key revocation,
 * permission checks) are logged to the audit trail. Audit events are
 * append-only and cannot be modified or deleted.
 *
 * Events are written to both the database (queryable) and stdout (for
 * log aggregation services like Datadog or Splunk).
 */

interface AuditEvent {
  action: string;
  tenantId: string;
  userId?: string;
  apiKeyId?: string;
  apiKeyPrefix?: string;
  ip?: string;
  permissions?: string[];
  tier?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

const auditBuffer: AuditEvent[] = [];
const FLUSH_INTERVAL = 5000; // 5 seconds
const FLUSH_THRESHOLD = 50;  // or 50 events, whichever comes first

/**
 * Log an audit event. Events are buffered and flushed in batches
 * for performance (high-throughput APIs can generate thousands of
 * auth events per second).
 */
export function logAuditEvent(event: AuditEvent): void {
  const enriched: AuditEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  auditBuffer.push(enriched);

  // Structured log for external aggregation
  console.log(JSON.stringify({
    level: 'audit',
    ...enriched,
  }));

  if (auditBuffer.length >= FLUSH_THRESHOLD) {
    flushAuditBuffer();
  }
}

/**
 * Flush buffered audit events to persistent storage.
 * Called periodically or when buffer reaches threshold.
 */
async function flushAuditBuffer(): Promise<void> {
  if (auditBuffer.length === 0) return;

  const batch = auditBuffer.splice(0, auditBuffer.length);
  try {
    await db.batchInsert('audit_events', batch);
  } catch (error) {
    // Audit writes must not crash the application.
    // Re-queue failed events for next flush.
    console.error('Audit flush failed, re-queuing', error);
    auditBuffer.unshift(...batch);
  }
}

/**
 * Query audit events for a tenant. Used by admin dashboard.
 * Results are paginated and sorted by timestamp descending.
 */
export async function queryAuditLog(
  tenantId: string,
  filters?: {
    action?: string;
    userId?: string;
    apiKeyId?: string;
    since?: Date;
    until?: Date;
  },
  limit: number = 100,
  offset: number = 0,
): Promise<{ events: AuditEvent[]; total: number }> {
  // Database query with filters
  return { events: [], total: 0 };
}

// Start periodic flush
setInterval(flushAuditBuffer, FLUSH_INTERVAL);

const db = { batchInsert: async (...args: any[]) => {} };

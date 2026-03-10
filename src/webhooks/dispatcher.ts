import { categorizeError } from '../errors/handler';

interface WebhookConfig {
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  signature: string;
}

const registeredWebhooks: WebhookConfig[] = [];

/**
 * Register a webhook endpoint for specific events.
 * Events: user.created, user.updated, user.deleted, user.role_changed,
 *         api_key.created, api_key.revoked, auth.failed
 */
export function registerWebhook(config: WebhookConfig): void {
  if (!config.url || !config.events.length) {
    throw new Error('Webhook requires url and at least one event');
  }
  registeredWebhooks.push(config);
}

/**
 * Dispatch an event to all registered webhooks.
 * Delivery is async and non-blocking — failures are logged, not thrown.
 * Retries: 3 attempts with exponential backoff (1s, 5s, 25s).
 */
export async function dispatchEvent(
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  const matching = registeredWebhooks.filter(
    (w) => w.active && w.events.includes(event),
  );

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    signature: '', // computed per-webhook below
  };

  await Promise.allSettled(
    matching.map((webhook) =>
      deliverWithRetry(webhook, { ...payload, signature: sign(payload, webhook.secret) }),
    ),
  );
}

async function deliverWithRetry(
  webhook: WebhookConfig,
  payload: WebhookPayload,
  attempt: number = 1,
): Promise<void> {
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': payload.signature,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok && attempt < 3) {
      const delay = Math.pow(5, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return deliverWithRetry(webhook, payload, attempt + 1);
    }
  } catch (error) {
    if (attempt < 3) {
      const delay = Math.pow(5, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return deliverWithRetry(webhook, payload, attempt + 1);
    }
    console.error(`Webhook delivery failed after 3 attempts: ${webhook.url}`, error);
  }
}

function sign(payload: WebhookPayload, secret: string): string {
  // HMAC-SHA256 signature
  return ''; // placeholder
}

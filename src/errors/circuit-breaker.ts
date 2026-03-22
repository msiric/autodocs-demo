import { categorizeError } from './handler';

/**
 * Circuit breaker for external service calls.
 *
 * Tracks failure rates per service and trips the circuit when failures
 * exceed the threshold, preventing cascading failures. Supports three
 * states: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing recovery).
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery (OPEN → HALF_OPEN) */
  resetTimeoutMs: number;
  /** Number of successful calls in HALF_OPEN to close the circuit */
  successThreshold: number;
}

interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt?: Date;
  lastStateChangeAt: Date;
}

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000, // 30 seconds
  successThreshold: 2,
};

/** Per-service circuit state */
const circuits = new Map<string, CircuitStats>();

/**
 * Execute a function with circuit breaker protection.
 *
 * @param serviceName - Identifier for the external service (e.g., 'database', 'cache', 'webhook')
 * @param fn - The async function to execute
 * @param config - Optional circuit configuration override
 * @returns The function's return value
 * @throws CircuitOpenError if the circuit is open
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  config: CircuitConfig = DEFAULT_CONFIG,
): Promise<T> {
  const circuit = getOrCreateCircuit(serviceName);

  // Check if circuit should transition from OPEN to HALF_OPEN
  if (circuit.state === 'OPEN') {
    const elapsed = Date.now() - (circuit.lastFailureAt?.getTime() ?? 0);
    if (elapsed >= config.resetTimeoutMs) {
      circuit.state = 'HALF_OPEN';
      circuit.successes = 0;
      circuit.lastStateChangeAt = new Date();
    } else {
      throw categorizeError(
        new CircuitOpenError(serviceName, config.resetTimeoutMs - elapsed),
        'circuitBreaker',
      );
    }
  }

  try {
    const result = await fn();

    // Record success
    if (circuit.state === 'HALF_OPEN') {
      circuit.successes++;
      if (circuit.successes >= config.successThreshold) {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
        circuit.lastStateChangeAt = new Date();
      }
    } else {
      circuit.failures = 0; // Reset on success in CLOSED state
    }

    return result;
  } catch (error) {
    // Record failure
    circuit.failures++;
    circuit.lastFailureAt = new Date();

    if (circuit.failures >= config.failureThreshold) {
      circuit.state = 'OPEN';
      circuit.lastStateChangeAt = new Date();
    }

    throw error;
  }
}

/**
 * Get the current state of a circuit.
 */
export function getCircuitState(serviceName: string): CircuitStats | undefined {
  return circuits.get(serviceName);
}

/**
 * Manually reset a circuit to CLOSED state.
 */
export function resetCircuit(serviceName: string): void {
  const circuit = circuits.get(serviceName);
  if (circuit) {
    circuit.state = 'CLOSED';
    circuit.failures = 0;
    circuit.successes = 0;
    circuit.lastStateChangeAt = new Date();
  }
}

function getOrCreateCircuit(serviceName: string): CircuitStats {
  let circuit = circuits.get(serviceName);
  if (!circuit) {
    circuit = {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastStateChangeAt: new Date(),
    };
    circuits.set(serviceName, circuit);
  }
  return circuit;
}

/**
 * Error thrown when a circuit is open and calls are being blocked.
 */
export class CircuitOpenError extends Error {
  constructor(
    public serviceName: string,
    public retryAfterMs: number,
  ) {
    super(`Circuit breaker open for ${serviceName}. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
  }
}

/**
 * Lightweight In-Memory Circuit Breaker for Primary LLM Provider (Groq)
 *
 * Prevents hammering a primary provider when it is repeatedly rate-limited or experiencing outage.
 * Note: Resets when server process restarts (documented in-memory behavior).
 */

interface ProviderCircuitState {
  failures: number;
  lastFailureAt: number;
  cooldownUntil: number;
}

const circuitState: ProviderCircuitState = {
  failures: 0,
  lastFailureAt: 0,
  cooldownUntil: 0,
};

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60_000; // 60 seconds cooldown

export function isPrimaryProviderAvailable(): boolean {
  const now = Date.now();
  if (now < circuitState.cooldownUntil) {
    return false;
  }
  return true;
}

export function recordPrimarySuccess(): void {
  circuitState.failures = 0;
  circuitState.lastFailureAt = 0;
  circuitState.cooldownUntil = 0;
}

export function recordPrimaryFailure(): void {
  const now = Date.now();

  // Reset failure count if last failure was over 60 seconds ago
  if (now - circuitState.lastFailureAt > COOLDOWN_MS) {
    circuitState.failures = 1;
  } else {
    circuitState.failures += 1;
  }

  circuitState.lastFailureAt = now;

  if (circuitState.failures >= FAILURE_THRESHOLD) {
    circuitState.cooldownUntil = now + COOLDOWN_MS;
  }
}

export function getPrimaryCircuitStatus(): {
  isAvailable: boolean;
  failures: number;
  cooldownRemainingMs: number;
} {
  const now = Date.now();
  const isAvailable = now >= circuitState.cooldownUntil;
  const cooldownRemainingMs = isAvailable ? 0 : Math.max(0, circuitState.cooldownUntil - now);

  return {
    isAvailable,
    failures: circuitState.failures,
    cooldownRemainingMs,
  };
}

export function resetCircuitBreaker(): void {
  circuitState.failures = 0;
  circuitState.lastFailureAt = 0;
  circuitState.cooldownUntil = 0;
}

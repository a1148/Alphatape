interface BreakerState {
  failures: number;
  openUntil: number;
}

export class CircuitBreaker {
  private states = new Map<string, BreakerState>();

  constructor(
    private threshold = 5,
    private resetMs = 60_000,
  ) {}

  async exec<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const state = this.states.get(key) ?? { failures: 0, openUntil: 0 };
    const now = Date.now();
    if (state.openUntil > now) {
      throw new Error(`circuit_open:${key}`);
    }
    try {
      const result = await fn();
      this.states.set(key, { failures: 0, openUntil: 0 });
      return result;
    } catch (error) {
      const failures = state.failures + 1;
      this.states.set(key, {
        failures,
        openUntil: failures >= this.threshold ? now + this.resetMs : 0,
      });
      throw error;
    }
  }
}

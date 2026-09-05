/**
 * Enterprise Test Framework Harness
 * Provides assertions, mock factories, performance timers, and visual colorized CLI output.
 */

export interface TestResult {
  name: string;
  category: 'UNIT' | 'INTEGRATION' | 'E2E' | 'PERFORMANCE';
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

interface TestDef {
  name: string;
  fn: () => Promise<void> | void;
}

export class TestSuite {
  private testDefs: TestDef[] = [];
  private results: TestResult[] = [];
  public readonly suiteName: string;
  public readonly category: 'UNIT' | 'INTEGRATION' | 'E2E' | 'PERFORMANCE';

  constructor(suiteName: string, category: 'UNIT' | 'INTEGRATION' | 'E2E' | 'PERFORMANCE') {
    this.suiteName = suiteName;
    this.category = category;
  }

  test(name: string, fn: () => Promise<void> | void) {
    this.testDefs.push({ name, fn });
  }

  async run(): Promise<TestResult[]> {
    this.results = [];
    for (const { name, fn } of this.testDefs) {
      const start = performance.now();
      try {
        await fn();
        const durationMs = Number((performance.now() - start).toFixed(2));
        this.results.push({
          name,
          category: this.category,
          passed: true,
          durationMs,
        });
        console.log(`  \x1b[32m✔\x1b[0m \x1b[90m[${this.category}]\x1b[0m ${name} \x1b[90m(${durationMs}ms)\x1b[0m`);
      } catch (err: any) {
        const durationMs = Number((performance.now() - start).toFixed(2));
        const errorMsg = err?.stack || err?.message || String(err);
        this.results.push({
          name,
          category: this.category,
          passed: false,
          durationMs,
          error: errorMsg,
        });
        console.log(`  \x1b[31m✖\x1b[0m \x1b[90m[${this.category}]\x1b[0m ${name} \x1b[90m(${durationMs}ms)\x1b[0m`);
        console.log(`    \x1b[31m${errorMsg.split('\n')[0]}\x1b[0m`);
      }
    }
    return this.results;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  printSummary() {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const totalTime = this.results.reduce((acc, r) => acc + r.durationMs, 0).toFixed(2);

    console.log(`\n\x1b[1mSummary: ${this.suiteName}\x1b[0m`);
    console.log(`  Total: ${this.results.length} | \x1b[32mPassed: ${passed}\x1b[0m | \x1b[31mFailed: ${failed}\x1b[0m | Time: ${totalTime}ms\n`);
  }
}

// Fluent Assertions Library
export const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${JSON.stringify(expected)} (type: ${typeof expected}) but received ${JSON.stringify(actual)} (type: ${typeof actual})`);
    }
  },
  toEqual: (expected: any) => {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      throw new Error(`Deep equality failure:\nExpected: ${expStr}\nReceived: ${actStr}`);
    }
  },
  toBeGreaterThan: (expected: number) => {
    if (typeof actual !== 'number' || actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  },
  toBeLessThan: (expected: number) => {
    if (typeof actual !== 'number' || actual >= expected) {
      throw new Error(`Expected ${actual} to be less than ${expected}`);
    }
  },
  toBeLessThanOrEqual: (expected: number) => {
    if (typeof actual !== 'number' || actual > expected) {
      throw new Error(`Expected ${actual} to be less than or equal to ${expected}`);
    }
  },
  toBeTruthy: () => {
    if (!actual) {
      throw new Error(`Expected truthy value, but received: ${JSON.stringify(actual)}`);
    }
  },
  toBeFalsy: () => {
    if (actual) {
      throw new Error(`Expected falsy value, but received: ${JSON.stringify(actual)}`);
    }
  },
  toBeNull: () => {
    if (actual !== null) {
      throw new Error(`Expected null, but received: ${JSON.stringify(actual)}`);
    }
  },
  toContain: (item: any) => {
    if (Array.isArray(actual)) {
      if (!actual.includes(item)) {
        throw new Error(`Array did not contain expected item: ${JSON.stringify(item)}`);
      }
    } else if (typeof actual === 'string') {
      if (!actual.includes(item)) {
        throw new Error(`String did not contain substring: "${item}". Actual: "${actual}"`);
      }
    } else {
      throw new Error(`Cannot call toContain on type ${typeof actual}`);
    }
  },
  toHaveProperty: (prop: string) => {
    if (!actual || typeof actual !== 'object' || !(prop in actual)) {
      throw new Error(`Object does not have property "${prop}"`);
    }
  },
});

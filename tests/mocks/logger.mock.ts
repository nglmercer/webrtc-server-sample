import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// Mock logger implementation for testing (Bun-compatible)
export interface MockLogger {
  debug: (message?: any, ...optionalParams: any[]) => void;
  info: (message?: any, ...optionalParams: any[]) => void;
  warn: (message?: any, ...optionalParams: any[]) => void;
  error: (message?: any, ...optionalParams: any[]) => void;
  log: (message?: any, ...optionalParams: any[]) => void;

  // Test helpers
  calls: Map<string, any[][]>;
  clear: () => void;
  wasCalled: (level: string) => boolean;
  getCallCount: (level: string) => number;
  getLastCall: (level: string) => any[];
}

export const createMockLogger = (): MockLogger => {
  const calls = new Map<string, any[][]>();

  const createLoggerFunction = (level: string) => {
    calls.set(level, []);

    return (message?: any, ...optionalParams: any[]) => {
      calls.get(level)!.push([message, ...optionalParams]);
    };
  };

  return {
    debug: createLoggerFunction("debug"),
    info: createLoggerFunction("info"),
    warn: createLoggerFunction("warn"),
    error: createLoggerFunction("error"),
    log: createLoggerFunction("log"),

    calls,

    clear() {
      calls.forEach((callList) => (callList.length = 0));
    },

    wasCalled(level: string): boolean {
      const callList = calls.get(level);
      return callList ? callList.length > 0 : false;
    },

    getCallCount(level: string): number {
      const callList = calls.get(level);
      return callList ? callList.length : 0;
    },

    getLastCall(level: string): any[] {
      const callList = calls.get(level);
      return callList && callList.length > 0
        ? callList[callList.length - 1]
        : [];
    },
  };
};

export const mockLoggerInstance = createMockLogger();

// Helper functions for test assertions
export const expectLogCall = (
  level: keyof MockLogger,
  message: string | RegExp,
  data?: any,
) => {
  expect(mockLoggerInstance.wasCalled(level)).toBeTrue();

  const lastCall = mockLoggerInstance.getLastCall(level);

  if (typeof message === "string") {
    expect(lastCall[0]).toContain(message);
  } else if (message instanceof RegExp) {
    expect(lastCall[0]).toMatch(message);
  }

  if (data !== undefined) {
    expect(lastCall[1]).toEqual(data);
  }
};

export const expectNoLogCall = (level: keyof MockLogger) => {
  expect(mockLoggerInstance.wasCalled(level)).toBeFalse();
};

export const resetMockLogger = () => {
  mockLoggerInstance.clear();
};

export const getLogCallCount = (level: keyof MockLogger): number => {
  return mockLoggerInstance.getCallCount(level);
};

export const getLogMessages = (level: keyof MockLogger): string[] => {
  const callList = mockLoggerInstance.calls.get(level);
  return callList ? callList.map((call) => call[0]) : [];
};

export const expectLogMessageWithPattern = (
  level: keyof MockLogger,
  pattern: RegExp,
  callIndex = -1,
) => {
  const callList = mockLoggerInstance.calls.get(level);
  if (!callList || callList.length === 0) {
    throw new Error(`No calls found for logger level: ${level}`);
  }

  const targetCall =
    callIndex >= 0 ? callList[callIndex] : callList[callList.length - 1];

  expect(targetCall).toBeDefined();
  expect(targetCall[0]).toMatch(pattern);
};

// Different logger configurations for different test scenarios
export const createSilentLogger = (): MockLogger => {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    log: () => {},
    calls: new Map(),
    clear: () => {},
    wasCalled: () => false,
    getCallCount: () => 0,
    getLastCall: () => [],
  };
};

export const createVerboseLogger = (): MockLogger => {
  const calls = new Map<string, any[][]>();

  const createVerboseFunction = (level: string) => {
    calls.set(level, []);

    return (message?: any, ...optionalParams: any[]) => {
      calls.get(level)!.push([message, ...optionalParams]);
      console.log(`[${level.toUpperCase()}]`, message, ...optionalParams);
    };
  };

  return {
    debug: createVerboseFunction("debug"),
    info: createVerboseFunction("info"),
    warn: createVerboseFunction("warn"),
    error: createVerboseFunction("error"),
    log: createVerboseFunction("log"),

    calls,

    clear() {
      calls.forEach((callList) => (callList.length = 0));
    },

    wasCalled(level: string): boolean {
      const callList = calls.get(level);
      return callList ? callList.length > 0 : false;
    },

    getCallCount(level: string): number {
      const callList = calls.get(level);
      return callList ? callList.length : 0;
    },

    getLastCall(level: string): any[] {
      const callList = calls.get(level);
      return callList && callList.length > 0
        ? callList[callList.length - 1]
        : [];
    },
  };
};

export const createErrorThrowingLogger = (): MockLogger => {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (message: string) => {
      throw new Error(`Logger error: ${message}`);
    },
    log: () => {},
    calls: new Map(),
    clear: () => {},
    wasCalled: () => false,
    getCallCount: () => 0,
    getLastCall: () => [],
  };
};

// Test-specific logger configurations
export const testLoggerConfigs = {
  silent: createSilentLogger(),
  verbose: createVerboseLogger(),
  errorThrowing: createErrorThrowingLogger(),
  default: mockLoggerInstance,
};

// Helper to check if specific log levels were called in order
export const expectLogCallsInOrder = (
  calls: Array<{ level: keyof MockLogger; message?: string | RegExp }>,
) => {
  let callHistory: Array<{ level: string; args: any[] }> = [];

  // Build call history
  mockLoggerInstance.calls.forEach((callList, level) => {
    callList.forEach((args) => {
      callHistory.push({ level, args });
    });
  });

  let currentIndex = 0;

  calls.forEach(({ level, message }) => {
    // Find the next occurrence of this level after currentIndex
    let foundIndex = -1;
    for (let i = currentIndex; i < callHistory.length; i++) {
      if (callHistory[i].level === level) {
        if (message) {
          const callMessage = callHistory[i].args[0];
          if (typeof message === "string") {
            if (callMessage.includes(message)) {
              foundIndex = i;
              break;
            }
          } else if (message instanceof RegExp) {
            if (message.test(callMessage)) {
              foundIndex = i;
              break;
            }
          }
        } else {
          foundIndex = i;
          break;
        }
      }
    }

    expect(foundIndex).toBeGreaterThanOrEqual(0);
    currentIndex = foundIndex + 1;
  });
};

// Cleanup helper for tests
export const cleanupLoggerMocks = () => {
  resetMockLogger();
};

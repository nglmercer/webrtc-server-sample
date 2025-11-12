export default {
  test: {
    match: ["**/*.test.{ts,tsx}"],
    testEnvironment: "node",
    moduleType: "module",
    timeout: 3000, // 3 seconds timeout for individual tests
    bail: true, // Stop on first failure
    preload: [],
    setupFiles: []
  }
};

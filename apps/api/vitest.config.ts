import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Run test files sequentially (not in parallel worker threads).
    // Required because rate limiting uses shared Redis keys per IP+route,
    // so parallel files would consume each other's quota.
    threads: false,
  
    // 60s timeout for rate-limit enforcement tests (they send 20+ sequential requests)
    testTimeout: 60000,
  },
});

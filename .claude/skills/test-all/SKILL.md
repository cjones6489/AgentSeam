---
name: test-all
description: Run all test suites across the monorepo and summarize results. Use when asked to run tests, check all tests, or verify the full test suite.
allowed-tools: Bash
user-invocable: true
---

Run both test suites and report results. These are independent and can run in parallel:

1. Root tests: `pnpm test`
2. Proxy tests: `pnpm proxy:test`

After both complete, summarize:
- Total test files and tests per suite
- Any failures with file paths and test names
- Overall pass/fail status

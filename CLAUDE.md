---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

The test suite is organized into three categories:

**Unit Tests** - Fast, isolated tests with mocks (default)
```bash
bun test                 # Run unit tests only (~37ms)
bun run test:unit        # Same as above
bun run test:watch       # Watch mode for TDD
```

**Integration Tests** - Tests requiring real Redis
```bash
bun run test:integration # Requires Redis running on localhost:6379
```

**Fixture Tests** - Data structure validation
```bash
bun run test:fixtures    # Validate data assumptions
```

**All Tests**
```bash
bun run test:all         # Run all 203 tests (~1.4s)
```

### Test Structure

```
tests/
├── unit/          # 161 tests - Mocked dependencies
├── integration/   # 6 tests - Real Redis connection
└── fixtures/      # 36 tests - Data validation
```

### Writing Tests

```ts#example.test.ts
import { test, expect, describe, beforeEach } from "bun:test";

describe("Feature", () => {
  beforeEach(() => {
    // Setup
  });

  test("should do something", () => {
    expect(1).toBe(1);
  });
});
```

**For integration tests requiring Redis:**
- Import `redis` from `bun` directly: `import { redis } from 'bun'`
- Don't use mocked `getRedisClient()` from src/cache/redis.js
- Place tests in `tests/integration/`
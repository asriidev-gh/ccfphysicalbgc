import "dotenv/config";
import { vi } from "vitest";

// `server-only` throws outside the Next.js server bundle; neutralise it for tests.
vi.mock("server-only", () => ({}));

// Tests must never touch the development database.
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required to run tests (see .env.example)");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
delete process.env.DIRECT_URL; // never let a remote/dev direct URL leak into tests
process.env.APP_SECRET ??= "test-secret-test-secret-test-secret";
process.env.BCRYPT_ROUNDS = "4";

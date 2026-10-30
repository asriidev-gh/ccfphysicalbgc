import "dotenv/config";
import { execSync } from "node:child_process";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set");
const u = new URL(url);
const dbName = u.pathname.slice(1);
if (!/^[a-z0-9_]+$/i.test(dbName)) throw new Error("Unsafe database name");
if (!dbName.includes("test")) throw new Error("Refusing to prepare a database whose name does not contain 'test'");

async function main() {
  const admin = new URL(url!);
  admin.pathname = "/postgres";
  admin.search = "";
  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  const r = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (r.rowCount === 0) {
    await c.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database ${dbName}`);
  }
  await c.end();
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

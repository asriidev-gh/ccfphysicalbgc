import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { VOTER_COOKIE } from "@/lib/services/booth";

/** The visitor's anonymous device id, created (and set as a cookie) on first use. Works in actions and route handlers. */
export async function ensureVoterId(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(VOTER_COOKIE)?.value;
  if (!id || id.length < 16) {
    id = randomBytes(18).toString("base64url");
    jar.set(VOTER_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return id;
}

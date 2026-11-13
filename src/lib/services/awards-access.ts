import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export const AWARDS_ACCESS_COOKIE = "awards_access";

/** The voting-page password. Set AWARDS_PASSWORD in the environment to change it without a code change. */
const password = () => process.env.AWARDS_PASSWORD || "becomegodschampion";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** What the access cookie holds. Derived from the password, so changing the password logs everyone out. */
function token(): string {
  return digest(`${process.env.APP_SECRET ?? ""}:awards-access:${password()}`).toString("hex");
}

const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export const checkAwardsPassword = (input: string) => same(input.trim(), password());
export const awardsAccessToken = token;
export const hasAwardsAccess = (cookieValue: string | undefined) => !!cookieValue && same(cookieValue, token());

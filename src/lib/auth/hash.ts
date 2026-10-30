import bcrypt from "bcryptjs";

// Cost 12 in production; tests may lower it for speed via BCRYPT_ROUNDS.
const ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

export const hashPassword = (pw: string) => bcrypt.hash(pw, ROUNDS);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
export const hashPasswordSync = (pw: string) => bcrypt.hashSync(pw, ROUNDS);

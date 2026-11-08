import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";

const MAX_PHOTO_BYTES = 150_000;
const FOLDER = "physical-bgc/participants";
/** Every uploaded file is named ccfbgcsports2ndyranniv_<random>, so the event's photos are easy to find in Cloudinary. */
const ID_PREFIX = "ccfbgcsports2ndyranniv_";

/** The browser sends a small resized JPEG as a data URL. Verify it really is one before it leaves our server. */
export function checkPhoto(dataUrl: string, maxBytes = MAX_PHOTO_BYTES): void {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  const bytes = m ? Buffer.from(m[1], "base64") : null;
  if (!bytes || bytes.length < 100 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
    throw new AppError("VALIDATION", "That photo could not be read. Please try another one.", { photo: "Invalid photo" });
  if (bytes.length > maxBytes) throw new AppError("VALIDATION", "That photo is too large.", { photo: "Photo too large" });
}

/** CLOUDINARY_URL (cloudinary://key:secret@cloud) or the three separate variables. */
function credentials() {
  const url = process.env.CLOUDINARY_URL?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  const cloud = url?.[3] ?? process.env.CLOUDINARY_CLOUD_NAME;
  const key = url?.[1] ?? process.env.CLOUDINARY_API_KEY;
  const secret = url?.[2] ?? process.env.CLOUDINARY_API_SECRET;
  return cloud && key && secret ? { cloud, key, secret } : null;
}

export function photosConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Signed server-side upload. The public id is random, so the delivery URL cannot be guessed;
 * it is only ever shown to the participant and to signed-in staff.
 */
export async function uploadPhoto(dataUrl: string, opts: { folder?: string; maxBytes?: number } = {}): Promise<string> {
  const folder = opts.folder ?? FOLDER;
  checkPhoto(dataUrl, opts.maxBytes);
  const c = credentials();
  if (!c) throw new AppError("CONFLICT", "Photo uploads are not set up yet. Please see an organizer.");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const publicId = ID_PREFIX + randomBytes(16).toString("hex");
  // Cloudinary signs the sorted parameters (excluding file and api_key) followed by the secret.
  const signature = createHash("sha1").update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${c.secret}`).digest("hex");
  const body = new FormData();
  body.set("file", dataUrl);
  body.set("api_key", c.key);
  body.set("timestamp", timestamp);
  body.set("public_id", publicId);
  body.set("folder", folder);
  body.set("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { secure_url?: string } | null;
  if (!res.ok || !json?.secure_url) throw new AppError("CONFLICT", "Your photo could not be saved. Please try again.");
  return json.secure_url;
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BOOTH_TEMPLATE_IDS } from "@/lib/booth/templates";
import { AppError } from "@/lib/errors";
import { ensureVoterId } from "@/lib/booth/voter";
import { BOOTH_MAX_BYTES, createBoothPhoto, voterHash } from "@/lib/services/booth";
import { rateLimit } from "@/lib/services/ratelimit";
import { uploadPhoto } from "@/lib/services/photo";

/** Raw image/jpeg body (not a Server Action, whose body limit is far too small for a full strip). */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    await rateLimit(db, "booth-upload", ip, { limit: 20, windowSeconds: 3600 });
    if (req.headers.get("content-type") !== "image/jpeg") throw new AppError("VALIDATION", "Unsupported image type.");
    if (Number(req.headers.get("content-length") ?? 0) > BOOTH_MAX_BYTES + 1024)
      throw new AppError("VALIDATION", "That photo is too large.");
    const bytes = Buffer.from(await req.arrayBuffer());
    if (bytes.length > BOOTH_MAX_BYTES) throw new AppError("VALIDATION", "That photo is too large.");
    const dataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const templateId = req.headers.get("x-template") ?? "";
    // Validate the template before spending a Cloudinary upload.
    if (!BOOTH_TEMPLATE_IDS.includes(templateId)) throw new AppError("VALIDATION", "Unknown template.");
    let ownerName = "";
    try {
      ownerName = decodeURIComponent(req.headers.get("x-owner") ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    } catch {
      /* malformed header: treat as no name */
    }
    if (!ownerName) throw new AppError("VALIDATION", "Please enter your name before publishing.");
    const imageUrl = await uploadPhoto(dataUrl, { folder: "physical-bgc/booth", maxBytes: BOOTH_MAX_BYTES });
    const photo = await createBoothPhoto(db, { imageUrl, templateId, ownerHash: voterHash(await ensureVoterId()), ownerName });
    return NextResponse.json({ ok: true, id: photo.id, url: photo.imageUrl });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: e.code === "RATE_LIMITED" ? 429 : e.code === "CONFLICT" ? 503 : 400 },
      );
    }
    console.error("[booth] upload failed", e);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

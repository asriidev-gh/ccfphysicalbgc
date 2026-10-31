"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";

const W = 600;
const PAD = 40;
const QR = W - PAD * 2;
const LOGO = 110;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Shrinks the font until the text fits the ticket width. */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: string, size: number, family: string) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
  } while (ctx.measureText(text).width > QR && --s > 14);
}

/**
 * Check-in ticket: label, QR with the CCF BGC mark in the middle, name and code, drawn to one
 * canvas so the same image can be downloaded. The QR must be generated with error correction "H"
 * so the covered centre still scans.
 */
export function QrTicket({ qr, name, code }: { qr: string; name: string; code: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      await document.fonts.ready;
      const [qrImg, logo] = await Promise.all([loadImage(qr), loadImage("/assets/images/ccfbgc.jpg")]);
      if (cancelled) return;

      const css = getComputedStyle(document.documentElement);
      const heading = `${css.getPropertyValue("--font-heading").trim() || "Arial Narrow"}, Impact, sans-serif`;
      const body = `${css.getPropertyValue("--font-body").trim() || "system-ui"}, sans-serif`;
      const brand = css.getPropertyValue("--brand").trim() || "#e5301f";
      const accent = css.getPropertyValue("--accent").trim() || "#f08a3c";

      const qrTop = 110;
      const nameY = qrTop + QR + 60;
      const codeY = nameY + 64;
      const H = codeY + 50;
      canvas.width = W;
      canvas.height = H;

      ctx.fillStyle = "#ffffff";
      roundRect(ctx, 0, 0, W, H, 28);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      ctx.fillStyle = brand;
      ctx.font = `700 46px ${heading}`;
      ctx.letterSpacing = "4px";
      ctx.fillText("CCF BGC SPORTS", W / 2, 76);
      ctx.letterSpacing = "0px";

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImg, PAD, qrTop, QR, QR);
      ctx.imageSmoothingEnabled = true;

      const lx = (W - LOGO) / 2;
      const ly = qrTop + (QR - LOGO) / 2;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, lx - 8, ly - 8, LOGO + 16, LOGO + 16, 18);
      ctx.fill();
      ctx.save();
      roundRect(ctx, lx, ly, LOGO, LOGO, 12);
      ctx.clip();
      ctx.drawImage(logo, lx, ly, LOGO, LOGO);
      ctx.restore();

      ctx.fillStyle = "#0b0b0c";
      fitText(ctx, name, "700", 36, body);
      ctx.fillText(name, W / 2, nameY);

      ctx.fillStyle = accent;
      fitText(ctx, code, "700", 52, heading);
      ctx.fillText(code, W / 2, codeY);

      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [qr, name, code]);

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div className="mx-auto flex w-[260px] max-w-full flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`QR code for registration ${code}, ${name}`}
        className="aspect-[600/804] h-auto w-full rounded-xl bg-white"
      />
      <Button type="button" variant="secondary" size="sm" className="w-full" onClick={download} disabled={!ready}>
        <Download className="size-4" aria-hidden />
        Download QR
      </Button>
    </div>
  );
}

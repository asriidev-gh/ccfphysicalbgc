"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** Camera QR scanner. Calls onScan once per distinct code (same code is ignored for 3s). */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    let last = { text: "", at: 0 };
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        await v.play();
        timer = setInterval(() => {
          if (!ctx || v.videoWidth === 0) return;
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code?.data && (code.data !== last.text || Date.now() - last.at > 3000)) {
            last = { text: code.data, at: Date.now() };
            onScanRef.current(code.data);
          }
        }, 200);
      })
      .catch(() => setError("Camera unavailable. Allow camera access (HTTPS is required on phones) or type the code instead."));

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error)
    return (
      <p role="alert" className="text-bad text-sm">
        {error}
      </p>
    );
  return (
    <video ref={video} muted playsInline className="border-line aspect-square w-full max-w-xs rounded-md border bg-black object-cover" />
  );
}

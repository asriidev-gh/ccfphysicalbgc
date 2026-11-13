"use client";

import { useRef } from "react";

/** Small QR thumbnail; click to open it large in a dialog (click outside or Esc to close). */
export function QrThumb({ qr, name, code }: { qr: string; name: string; code: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} aria-label={`Enlarge QR code for ${name}`} className="block cursor-zoom-in">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
        <img src={qr} alt={`QR code for ${code}`} className="size-16 rounded-sm bg-white" />
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="bg-surface text-fg border-line m-auto rounded-lg border p-6 backdrop:bg-black/70"
      >
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={qr} alt={`QR code for ${code}`} className="size-[min(80vw,420px)] rounded-md bg-white" />
          <p className="font-display text-2xl font-bold">{code}</p>
          <p className="text-muted text-sm">{name}</p>
          <button type="button" onClick={() => ref.current?.close()} className="border-line bg-surface-2 min-h-10 rounded-md border px-4 font-semibold">
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}

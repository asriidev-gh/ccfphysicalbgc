/** Square face-centred thumbnail via Cloudinary's delivery transformations (safe to import in client components). */
export function photoThumb(url: string, size: number): string {
  return url.replace("/upload/", `/upload/c_fill,g_face,w_${size},h_${size},q_auto,f_auto/`);
}

/** Gallery-sized delivery (longest side capped, auto format/quality). Safe for client components. */
export function boothThumb(url: string, width: number): string {
  return url.replace("/upload/", `/upload/c_limit,w_${width},q_auto,f_auto/`);
}

/** Cloudinary's attachment flag makes the browser save the file instead of opening it (works on phones). */
export function boothDownload(url: string): string {
  return url.replace("/upload/", "/upload/fl_attachment:ccfbgc-photobooth/");
}

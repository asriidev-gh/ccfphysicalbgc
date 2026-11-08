/** Square face-centred thumbnail via Cloudinary's delivery transformations (safe to import in client components). */
export function photoThumb(url: string, size: number): string {
  return url.replace("/upload/", `/upload/c_fill,g_face,w_${size},h_${size},q_auto,f_auto/`);
}

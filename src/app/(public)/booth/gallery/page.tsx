import { redirect } from "next/navigation";

/** The gallery now lives at /booth. Keeps old links and QR codes working. */
export default function OldGalleryRoute() {
  redirect("/booth");
}

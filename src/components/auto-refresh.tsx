"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ConnectionBadge, useLiveSignal } from "@/components/live";

/** Re-renders the surrounding server component whenever the event's results change. */
export function AutoRefresh({ eventId }: { eventId: string }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const conn = useLiveSignal(eventId, null, refresh);
  return <ConnectionBadge conn={conn} />;
}

import { subscribe, type BusMessage } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public Server-Sent Events stream. Carries only change signals (ids), never data;
 * clients re-fetch the published leaderboard themselves, so nothing private can leak here.
 * Query: eventId (required), activityId (optional filter).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") ?? "";
  const activityId = url.searchParams.get("activityId");
  if (!UUID.test(eventId) || (activityId && !UUID.test(activityId))) {
    return new Response("Bad request", { status: 400 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send(`retry: 3000\n\n`);
      send(`event: hello\ndata: {"at":${Date.now()}}\n\n`);

      const onMsg = (m: BusMessage) => {
        if (m.eventId !== eventId) return;
        if (m.kind === "results" && activityId && m.activityId !== activityId) return;
        send(`event: change\ndata: ${JSON.stringify(m)}\n\n`);
      };
      const unsubscribe = subscribe(onMsg);
      const heartbeat = setInterval(() => send(`: ping\n\n`), 20_000);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

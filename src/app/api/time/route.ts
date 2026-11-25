export const dynamic = "force-dynamic";

/** The server clock, so a booth device can measure its offset before timing runs. */
export function GET() {
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}

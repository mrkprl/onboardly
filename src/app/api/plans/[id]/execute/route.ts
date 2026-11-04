import { executePlan } from "@/lib/execution";

export const maxDuration = 120;

export async function POST(_request: Request, ctx: RouteContext<"/api/plans/[id]/execute">) {
  const { id } = await ctx.params;
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      // L'esecuzione va avanti fino in fondo anche se chi l'ha avviata chiude la scheda
      try {
        for await (const event of executePlan(id)) send(event);
      } catch (error) {
        console.error(error);
        send({ type: "error", message: "Errore interno durante l'esecuzione" });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

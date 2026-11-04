import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { runAgent } from "@/lib/agent";

export const maxDuration = 120;

const MAX_BODY_CHARS = 200_000;
const MAX_USER_TEXT = 2_000;

const ConversationSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.union([z.string(), z.array(z.object({ type: z.string() }).passthrough())]),
      }),
    )
    .min(1)
    .max(80)
    .refine((m) => m[0].role === "user" && m[m.length - 1].role === "user")
    .refine((m) => {
      const last = m[m.length - 1].content;
      return typeof last === "string" && last.trim().length > 0 && last.length <= MAX_USER_TEXT;
    }),
});

export async function POST(request: Request) {
  // La cronologia arriva dal browser: limiti di dimensione per tenere sotto controllo i costi
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) {
    return Response.json({ error: "Conversazione troppo lunga: ricarica la pagina e ricomincia" }, { status: 413 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {}
  const parsed = ConversationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Conversazione non valida" }, { status: 400 });
  }
  const messages = parsed.data.messages as Anthropic.Beta.BetaMessageParam[];

  try {
    return Response.json(await runAgent(messages));
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Troppe richieste, riprova tra poco" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Errore Claude API", error.status, error.message);
      return Response.json({ error: "L'assistente non è disponibile al momento" }, { status: 502 });
    }
    console.error(error);
    return Response.json({ error: "Errore interno" }, { status: 500 });
  }
}

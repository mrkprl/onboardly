"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { Button, Card, Spinner, TextArea } from "@heroui/react";

type MessageParam = Anthropic.Beta.BetaMessageParam;

const SUGGESTIONS = [
  "Lunedì prossimo entra Giulia Rossi, Software Engineer nel team Growth, vuole un Mac.",
  "Dal 2 novembre arriva Marta Villa come Product Designer nel team Platform.",
  "Il 9 novembre inizia Luca Neri in Customer Success.",
  "Andrea Greco lascia l'azienda il 30 ottobre.",
];

function visibleMessages(messages: MessageParam[]) {
  return messages.flatMap((message, index) => {
    if (typeof message.content === "string") return [{ key: index, role: message.role, text: message.content }];
    const text = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlockParam => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    return text ? [{ key: index, role: message.role, text }] : [];
  });
}

export default function AgentChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageParam[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isLoading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || isLoading) return;
    const next: MessageParam[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore dell'assistente");
      setMessages(data.messages);
      if (data.proposedPlanIds?.length) router.refresh();
    } catch (err) {
      setMessages(messages);
      setInput(content);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  const visible = visibleMessages(messages);

  return (
    <Card
      className={`flex flex-col sm:h-[min(72dvh,720px)] ${
        visible.length > 0 || isLoading ? "max-sm:h-[min(80dvh,640px)]" : ""
      }`}
    >
      <Card.Header>
        <Card.Title>Assistente</Card.Title>
        <Card.Description>Conosce ruoli, dispositivi, licenze e persone. Prepara piani, non li esegue da solo.</Card.Description>
      </Card.Header>

      <Card.Content className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
        {visible.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">Esempi di richieste:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-xl border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-default"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {visible.map((m) => (
          <div
            key={m.key}
            className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
              m.role === "user" ? "self-end bg-accent text-accent-foreground" : "self-start bg-surface-secondary"
            }`}
          >
            {m.text.replace(/\*\*(.+?)\*\*/g, "$1")}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 self-start text-sm text-muted">
            <Spinner size="sm" /> Sto controllando dispositivi e licenze…
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div ref={bottomRef} />
      </Card.Content>

      <Card.Footer>
        <form
          className="flex w-full items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <TextArea
            aria-label="Messaggio per l'assistente"
            placeholder="Es. Il 3 novembre entra Sara Bruni, People Specialist…"
            value={input}
            rows={2}
            fullWidth
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <Button type="submit" isPending={isLoading} isDisabled={!input.trim()}>
            Invia
          </Button>
        </form>
      </Card.Footer>
    </Card>
  );
}

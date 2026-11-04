"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, Spinner } from "@heroui/react";
import { ArrowSquareOutIcon, CaretDownIcon, CheckIcon, ClockIcon, PaperclipIcon, XIcon } from "@phosphor-icons/react";
import { refreshPlansAction, rejectPlanAction } from "@/app/actions";
import { APP_URL_PLACEHOLDER } from "@/lib/constants";
import { formatDate, formatEuro } from "@/lib/format";

type StepStatus = "PENDING" | "RUNNING" | "DONE" | "WAITING_IT" | "FAILED";

export type StepView = { id: string; label: string; status: Exclude<StepStatus, "RUNNING">; detail: string | null };

export type PlanView = {
  id: string;
  kind: "ONBOARDING" | "OFFBOARDING";
  status: "PROPOSED" | "EXECUTING" | "APPROVED" | "REJECTED";
  name: string;
  role: string;
  team: string;
  date: string;
  returnMethod: "SHIPPING" | "OFFICE" | null;
  shipment: {
    id: string;
    status: "LABEL_CREATED" | "SHIPPED" | "DELIVERED";
    trackingCode: string;
    shippedAt: string | null;
  } | null;
  trackingCode: string | null;
  monthlyCost: number;
  steps: StepView[];
  emailText: string | null;
  firstWeekPlan: string | null;
};

type StreamEvent =
  | { type: "step"; stepId: string; status: StepStatus; detail?: string }
  | { type: "done"; summary: string }
  | { type: "error"; message: string };

const noopSubscribe = () => () => {};

function useOrigin() {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

const SHIPMENT_STATUS = {
  LABEL_CREATED: { label: "Etichetta pronta, in attesa di spedizione", color: "warning" },
  SHIPPED: { label: "Spedito dal dipendente", color: "accent" },
  DELIVERED: { label: "Consegnato all'IT", color: "success" },
} as const;

function EmailBody({ text }: { text: string }) {
  const origin = useOrigin();
  const parts = text.split(/(\{\{APP_URL\}\}\/\S+)/g);
  return (
    <p className="mt-2 whitespace-pre-line text-muted">
      {parts.map((part, i) => {
        if (!part.startsWith(APP_URL_PLACEHOLDER)) return part;
        const path = part.slice(APP_URL_PLACEHOLDER.length);
        // Solo percorsi interni: il testo della mail lo scrive l'agente, "//altro-sito" sarebbe un link esterno
        if (!path.startsWith("/") || path.startsWith("//")) return part;
        return (
          <a key={i} href={path} target="_blank" rel="noopener noreferrer" className="font-medium break-all text-accent hover:underline">
            {origin}
            {path}
          </a>
        );
      })}
    </p>
  );
}

const STATUS_CHIP = {
  PROPOSED: { label: "Da approvare", color: "warning" },
  EXECUTING: { label: "Interrotto", color: "danger" },
  APPROVED: { label: "Eseguito", color: "success" },
  REJECTED: { label: "Rifiutato", color: "default" },
} as const;

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "RUNNING") return <Spinner size="sm" />;
  const base = "grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-300";
  if (status === "DONE")
    return (
      <span className={`${base} bg-success text-success-foreground`}>
        <CheckIcon size={12} weight="bold" aria-hidden />
      </span>
    );
  if (status === "WAITING_IT")
    return (
      <span className={`${base} bg-warning-soft text-warning`}>
        <ClockIcon size={13} weight="bold" aria-hidden />
      </span>
    );
  if (status === "FAILED")
    return (
      <span className={`${base} bg-danger text-danger-foreground`}>
        <XIcon size={12} weight="bold" aria-hidden />
      </span>
    );
  return <span className={`${base} border-2 border-border`} />;
}

const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  PENDING: "Da eseguire",
  RUNNING: "In esecuzione",
  DONE: "Completato",
  WAITING_IT: "In attesa dell'IT",
  FAILED: "Errore",
};

export default function PlanCard({ plan }: { plan: PlanView }) {
  const router = useRouter();
  const [live, setLive] = useState<Record<string, { status: StepStatus; detail?: string }>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isRejecting, startReject] = useTransition();
  const [collapsed, setCollapsed] = useState(plan.status === "APPROVED" || plan.status === "REJECTED");
  const isOpen = !collapsed || isRunning;

  const isOnboarding = plan.kind === "ONBOARDING";
  const steps = plan.steps.map((s) => ({
    ...s,
    status: (live[s.id]?.status ?? s.status) as StepStatus,
    detail: live[s.id]?.detail ?? s.detail,
  }));
  const done = steps.filter((s) => s.status === "DONE").length;
  const waiting = steps.filter((s) => s.status === "WAITING_IT").length;
  const canRun = plan.status === "PROPOSED" || plan.status === "EXECUTING";

  async function execute() {
    setIsRunning(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}/execute`, { method: "POST" });
      if (!res.body) throw new Error("Nessuna risposta dal server");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "step") {
            setLive((prev) => ({ ...prev, [event.stepId]: { status: event.status, detail: event.detail } }));
          } else if (event.type === "done") {
            setMessage({ ok: true, text: event.summary });
          } else {
            setMessage({ ok: false, text: event.message });
          }
        }
      }
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message });
    } finally {
      setIsRunning(false);
      await refreshPlansAction();
      router.refresh();
    }
  }

  const reject = () =>
    startReject(async () => {
      const res = await rejectPlanAction(plan.id);
      if (!res.ok) setMessage({ ok: false, text: res.error });
    });

  const status = isRunning ? { label: "In esecuzione", color: "accent" as const } : STATUS_CHIP[plan.status];

  return (
    <Card className={plan.status === "REJECTED" ? "opacity-70" : ""}>
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="soft" color={isOnboarding ? "accent" : "danger"}>
              {isOnboarding ? "Ingresso" : "Uscita"}
            </Chip>
            <Chip size="sm" variant="soft" color={status.color}>
              {status.label}
            </Chip>
            {plan.returnMethod && (
              <Chip size="sm" variant="soft">
                {plan.returnMethod === "SHIPPING" ? "Riconsegna via corriere" : "Riconsegna in ufficio"}
              </Chip>
            )}
          </div>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={`plan-${plan.id}-details`}
            onClick={() => setCollapsed((v) => !v)}
            className="group -my-1.5 flex min-h-10 w-fit items-center gap-1.5 text-left"
          >
            <Card.Title className="group-hover:text-accent">{plan.name}</Card.Title>
            <CaretDownIcon
              size={14}
              aria-hidden
              className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
            <span className="sr-only">{isOpen ? "Comprimi dettagli" : "Mostra dettagli"}</span>
          </button>
          <Card.Description>
            {plan.role}, team {plan.team}. {isOnboarding ? "Inizio" : "Ultimo giorno"}{" "}
            {plan.date ? formatDate(plan.date) : "da definire"}
          </Card.Description>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold">
            {isOnboarding ? "" : "−"}
            {formatEuro(plan.monthlyCost)}
          </p>
          <p className="text-xs text-muted">{isOnboarding ? "licenze/mese" : "risparmio/mese"}</p>
        </div>
      </Card.Header>

      <Card.Content className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-default" aria-hidden>
            <div
              className="h-full rounded-full bg-success transition-[width] duration-500"
              style={{ width: `${(done / steps.length) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted tabular-nums">
            {done}/{steps.length}
            {waiting > 0 && `, ${waiting} in attesa dell'IT`}
          </span>
        </div>

        {isOpen && (
          <div id={`plan-${plan.id}-details`} className="flex flex-col gap-3">
            <ol className="flex flex-col gap-2" aria-label="Step del piano">
              {steps.map((step) => (
                <li key={step.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-px">
                    <StepIcon status={step.status} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={
                        step.status === "DONE" ? "text-foreground" : step.status === "PENDING" ? "text-muted" : "font-medium"
                      }
                    >
                      {step.label}
                      <span className="sr-only"> ({STEP_STATUS_LABEL[step.status]})</span>
                    </span>
                    {step.detail && <span className="text-xs text-muted">{step.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>

            {plan.shipment && (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/labels/${plan.shipment.id}`}
                  target="_blank"
                  className="inline-flex w-fit items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-default"
                >
                  Apri etichetta di spedizione
                  <ArrowSquareOutIcon size={14} aria-hidden />
                </Link>
                <Chip size="sm" variant="soft" color={SHIPMENT_STATUS[plan.shipment.status].color}>
                  {SHIPMENT_STATUS[plan.shipment.status].label}
                  {plan.shipment.status === "SHIPPED" &&
                    plan.shipment.shippedAt &&
                    ` il ${formatDate(plan.shipment.shippedAt)}`}
                </Chip>
              </div>
            )}

            {plan.emailText && (
              <details className="rounded-xl bg-surface-secondary p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  {isOnboarding ? "Mail di benvenuto" : "Mail di uscita"}
                </summary>
                <EmailBody text={plan.emailText} />
                {plan.trackingCode && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <span className="text-xs text-muted">Allegato</span>
                    {plan.shipment ? (
                      <Link
                        href={`/labels/${plan.shipment.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-default"
                      >
                        <PaperclipIcon size={14} aria-hidden />
                        etichetta-reso-{plan.trackingCode}.pdf
                      </Link>
                    ) : (
                      <span className="rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs text-muted">
                        etichetta-reso-{plan.trackingCode}.pdf (generata all&apos;approvazione)
                      </span>
                    )}
                  </div>
                )}
              </details>
            )}
            {plan.firstWeekPlan && (
              <details className="rounded-xl bg-surface-secondary p-3 text-sm">
                <summary className="cursor-pointer font-medium">Piano prima settimana</summary>
                <p className="mt-2 whitespace-pre-line text-muted">{plan.firstWeekPlan}</p>
              </details>
            )}
          </div>
        )}

        {message && (
          <Alert status={message.ok ? "success" : "danger"}>
            <Alert.Content>
              <Alert.Title>{message.text}</Alert.Title>
            </Alert.Content>
          </Alert>
        )}
      </Card.Content>

      {canRun && isOpen && (
        <Card.Footer className="justify-end gap-2">
          <Button variant="ghost" isDisabled={isRunning} isPending={isRejecting} onPress={reject}>
            {plan.status === "EXECUTING" ? "Annulla piano" : "Rifiuta"}
          </Button>
          <Button variant={isOnboarding ? "primary" : "danger"} isPending={isRunning} onPress={execute}>
            {plan.status === "EXECUTING" ? "Riprendi esecuzione" : isOnboarding ? "Approva ed esegui" : "Approva uscita"}
          </Button>
        </Card.Footer>
      )}
    </Card>
  );
}

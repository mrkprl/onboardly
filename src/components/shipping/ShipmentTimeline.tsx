import { formatDate } from "@/lib/format";

type Status = "LABEL_CREATED" | "SHIPPED" | "DELIVERED";

export default function ShipmentTimeline({
  status,
  createdAt,
  shippedAt,
  deliveredAt,
}: {
  status: Status;
  createdAt: Date | string;
  shippedAt: Date | string | null;
  deliveredAt: Date | string | null;
}) {
  const order: Status[] = ["LABEL_CREATED", "SHIPPED", "DELIVERED"];
  const reached = order.indexOf(status);
  const steps = [
    { label: "Etichetta creata", date: createdAt },
    { label: "Spedito", date: shippedAt },
    { label: "Consegnato all'IT", date: deliveredAt },
  ];

  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Stato della spedizione">
      {steps.map((step, i) => {
        const done = i <= reached;
        return (
          <li key={step.label} className="flex flex-col gap-1.5">
            <span className={`h-1.5 rounded-full ${done ? "bg-success" : "bg-default"}`} aria-hidden />
            <span className={`text-xs ${done ? "font-medium text-foreground" : "text-muted"}`}>
              {step.label}
              <span className="sr-only">{done ? " (completato)" : " (in attesa)"}</span>
            </span>
            <span className="text-xs text-muted">{done && step.date ? formatDate(step.date) : "-"}</span>
          </li>
        );
      })}
    </ol>
  );
}

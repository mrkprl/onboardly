import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Card, Spinner } from "@heroui/react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { deviceLabel } from "@/lib/plans";
import { formatDate, isoDateRome } from "@/lib/format";
import ShipmentTimeline from "@/components/shipping/ShipmentTimeline";
import ShipmentConfirmForm from "@/components/shipping/ShipmentConfirmForm";

async function ShipmentConfirm({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const shipment = await db.shipment.findUnique({
    where: { confirmToken: token },
    include: { employee: true, requests: { include: { device: true } } },
  });
  if (!shipment) notFound();
  const devices = shipment.requests.flatMap((r) => (r.device ? [r.device] : []));
  const today = isoDateRome();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Ciao {shipment.employee.firstName}, hai spedito il pacco?
        </h1>
        <p className="text-muted text-pretty">
          Segnalaci quando hai consegnato il pacco al corriere: aggiorniamo il tracciamento e avvisiamo il team IT
          che i dispositivi sono in arrivo.
        </p>
      </div>

      <Card>
        <Card.Header>
          <Card.Title className="font-mono">{shipment.trackingCode}</Card.Title>
          <Card.Description>{shipment.carrier}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-5">
          <ShipmentTimeline
            status={shipment.status}
            createdAt={shipment.createdAt}
            shippedAt={shipment.shippedAt}
            deliveredAt={shipment.deliveredAt}
          />
          <div className="text-sm">
            <p className="font-medium">Contenuto del pacco</p>
            <ul className="mt-1 list-inside list-disc text-muted">
              {devices.map((d) => (
                <li key={d.id}>{deviceLabel(d)}</li>
              ))}
            </ul>
          </div>
          <Link
            href={`/spedizione/${token}/etichetta`}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-default"
          >
            Scarica di nuovo l&apos;etichetta
            <ArrowSquareOutIcon size={14} aria-hidden />
          </Link>
        </Card.Content>
      </Card>

      {shipment.status === "LABEL_CREATED" ? (
        <ShipmentConfirmForm token={token} today={today} minDate={isoDateRome(shipment.createdAt)} />
      ) : (
        <p className="rounded-2xl bg-success-soft p-4 text-sm text-success-soft-foreground">
          {shipment.status === "DELIVERED"
            ? `Il pacco è arrivato all'ufficio IT il ${formatDate(shipment.deliveredAt!)}. Grazie!`
            : `Grazie! Hai segnalato la spedizione il ${formatDate(shipment.shippedAt!)}. Ti scriviamo noi quando il pacco arriva.`}
        </p>
      )}

      <p className="text-xs text-muted">Pagina dimostrativa: nessuna spedizione reale.</p>
    </div>
  );
}

export default function ShipmentConfirmPage({ params }: PageProps<"/spedizione/[token]">) {
  return (
    <Suspense
      fallback={
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      }
    >
      <ShipmentConfirm params={params} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Spinner } from "@heroui/react";
import { db } from "@/lib/db";
import PrintButton from "@/components/PrintButton";
import ShippingLabel from "@/components/shipping/ShippingLabel";
import ShipmentTimeline from "@/components/shipping/ShipmentTimeline";

async function Label({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const shipment = await db.shipment.findUnique({
    where: { id },
    include: { requests: { include: { device: true } } },
  });
  if (!shipment) notFound();
  const devices = shipment.requests.flatMap((r) => (r.device ? [r.device] : []));

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Etichetta dimostrativa: nessuna spedizione reale.</p>
          <PrintButton />
        </div>
        <ShipmentTimeline
          status={shipment.status}
          createdAt={shipment.createdAt}
          shippedAt={shipment.shippedAt}
          deliveredAt={shipment.deliveredAt}
        />
        {shipment.shipperNote && <p className="text-sm text-muted">Nota del dipendente: {shipment.shipperNote}</p>}
      </div>
      <ShippingLabel shipment={{ ...shipment, devices }} />
    </div>
  );
}

export default function LabelPage({ params }: PageProps<"/labels/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      }
    >
      <Label params={params} />
    </Suspense>
  );
}

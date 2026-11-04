import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Spinner } from "@heroui/react";
import { db } from "@/lib/db";
import PrintButton from "@/components/PrintButton";
import ShippingLabel from "@/components/shipping/ShippingLabel";

async function PublicLabel({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const shipment = await db.shipment.findUnique({
    where: { confirmToken: token },
    include: { requests: { include: { device: true } } },
  });
  if (!shipment) notFound();
  const devices = shipment.requests.flatMap((r) => (r.device ? [r.device] : []));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/spedizione/${token}`}
        className="-my-2 inline-flex min-h-10 items-center gap-1.5 self-start text-sm text-muted hover:text-foreground print:hidden"
      >
        <ArrowLeftIcon size={16} aria-hidden />
        Torna alla conferma di spedizione
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">Stampa l&apos;etichetta e applicala sul pacco.</p>
        <PrintButton />
      </div>
      <ShippingLabel shipment={{ ...shipment, devices }} />
    </div>
  );
}

export default function PublicLabelPage({ params }: PageProps<"/spedizione/[token]/etichetta">) {
  return (
    <Suspense
      fallback={
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      }
    >
      <PublicLabel params={params} />
    </Suspense>
  );
}

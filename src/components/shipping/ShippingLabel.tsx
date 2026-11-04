import { deviceLabel } from "@/lib/plans";
import { formatDate } from "@/lib/format";

type LabelShipment = {
  carrier: string;
  trackingCode: string;
  fromAddress: string;
  toAddress: string;
  createdAt: Date;
  devices: { id: string; model: string; ramGb: number; serial: string; type: "LAPTOP" | "PHONE" }[];
};

function Barcode({ value }: { value: string }) {
  const bars = Array.from(value).flatMap((char, i) => {
    const code = char.charCodeAt(0);
    return [1 + (code % 3), 1 + ((code >> 2) % 2), 1 + ((code + i) % 3)];
  });
  const offsets = bars.map((_, i) => bars.slice(0, i).reduce((sum, w) => sum + w * 2, 0));
  const width = bars.reduce((sum, w) => sum + w * 2, 0);
  return (
    <svg viewBox={`0 0 ${width} 60`} className="h-16 w-full" aria-hidden preserveAspectRatio="none">
      {bars.map((w, i) => (i % 2 === 0 ? <rect key={i} x={offsets[i]} y={0} width={w} height={60} fill="currentColor" /> : null))}
    </svg>
  );
}

export default function ShippingLabel({ shipment }: { shipment: LabelShipment }) {
  return (
    <article className="flex flex-col divide-y-2 divide-black rounded-lg border-2 border-black bg-white font-mono text-sm text-black">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="text-lg font-bold tracking-tight">{shipment.carrier.replace(" (simulato)", "")}</span>
        <span className="rounded border-2 border-black px-2 py-0.5 text-xs font-bold">RESO PREPAGATO</span>
      </header>
      <section className="grid grid-cols-2 divide-x-2 divide-black">
        <div className="px-4 py-3">
          <p className="text-[10px] font-bold uppercase">Mittente</p>
          <p className="mt-1 whitespace-pre-line">{shipment.fromAddress.replace(", ", "\n")}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-bold uppercase">Data</p>
          <p className="mt-1">{formatDate(shipment.createdAt)}</p>
          <p className="mt-2 text-[10px] font-bold uppercase">Colli · Peso stimato</p>
          <p className="mt-1">1 · {(0.4 + shipment.devices.length * 1.2).toFixed(1)} kg</p>
        </div>
      </section>
      <section className="px-4 py-4">
        <p className="text-[10px] font-bold uppercase">Destinatario</p>
        <p className="mt-1 text-lg leading-snug font-bold whitespace-pre-line">
          {shipment.toAddress.replace(", ", "\n")}
        </p>
      </section>
      <section className="px-4 py-4">
        <Barcode value={shipment.trackingCode} />
        <p className="mt-2 text-center text-base font-bold tracking-[0.3em]">{shipment.trackingCode}</p>
      </section>
      <section className="px-4 py-3">
        <p className="text-[10px] font-bold uppercase">Contenuto</p>
        <ul className="mt-1 list-inside list-disc">
          {shipment.devices.map((d) => (
            <li key={d.id}>{deviceLabel(d)}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

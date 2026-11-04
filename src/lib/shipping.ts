import { db } from "@/lib/db";
import { formatDate, isoDateRome } from "@/lib/format";

export async function confirmShipment(token: string, input: { shippedOn: Date; note: string | null }) {
  const shipment = await db.shipment.findUnique({
    where: { confirmToken: token },
    include: { requests: { include: { planStep: true } }, employee: true },
  });
  if (!shipment) throw new Error("Link non valido o scaduto");
  if (shipment.status !== "LABEL_CREATED") throw new Error("La spedizione è già stata segnalata");

  if (isoDateRome(input.shippedOn) > isoDateRome()) throw new Error("La data di spedizione non può essere nel futuro");
  if (isoDateRome(input.shippedOn) < isoDateRome(shipment.createdAt)) {
    throw new Error("La data di spedizione non può precedere la creazione dell'etichetta");
  }

  const detail = `Spedito il ${formatDate(input.shippedOn)}, in transito (${shipment.trackingCode})`;
  await db.$transaction(async (tx) => {
    // Con due invii simultanei del form solo il primo trova la spedizione ancora da segnalare
    const { count } = await tx.shipment.updateMany({
      where: { id: shipment.id, status: "LABEL_CREATED" },
      data: { status: "SHIPPED", shippedAt: input.shippedOn, shipperNote: input.note },
    });
    if (count === 0) throw new Error("La spedizione è già stata segnalata");
    for (const r of shipment.requests) {
      if (r.planStep && r.status !== "DONE") await tx.planStep.update({ where: { id: r.planStep.id }, data: { detail } });
    }
    await tx.auditLog.create({
      data: {
        actor: "employee",
        action: "shipment.shipped",
        payload: {
          shipmentId: shipment.id,
          outcomes: [
            `${shipment.employee.firstName} ${shipment.employee.lastName} ha spedito il pacco ${shipment.trackingCode} il ${formatDate(input.shippedOn)}`,
            ...(input.note ? [`Nota: ${input.note}`] : []),
          ],
        },
      },
    });
  });
}

export async function markShipmentDeliveredIfComplete(shipmentId: string) {
  const open = await db.itRequest.count({ where: { shipmentId, status: { not: "DONE" } } });
  if (open > 0) return;
  const shipment = await db.shipment.update({
    where: { id: shipmentId },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      actor: "it",
      action: "shipment.delivered",
      payload: { shipmentId, outcomes: [`Pacco ${shipment.trackingCode} consegnato all'ufficio IT`] },
    },
  });
}

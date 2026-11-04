import { db } from "@/lib/db";
import { isoDateRome } from "@/lib/format";
import { syncPlanCompletion } from "@/lib/execution";
import { markShipmentDeliveredIfComplete } from "@/lib/shipping";
import { StepDataSchema, activeAssignmentsWhere, deviceLabel } from "@/lib/plans";
import type { DeviceStatus, DeviceType, Os } from "@/generated/prisma/client";

export async function completeItRequest(requestId: string, actor = "it") {
  const result = await db.$transaction(async (tx) => {
    // Chiusura atomica: con un doppio click la seconda chiamata trova la richiesta già DONE e si ferma qui
    const { count } = await tx.itRequest.updateMany({
      where: { id: requestId, status: { not: "DONE" } },
      data: { status: "DONE" },
    });
    if (count === 0) throw new Error("Richiesta già completata o inesistente");
    const request = await tx.itRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { employee: { include: { role: true } }, license: true, planStep: true },
    });
    const outcomes: string[] = [];
    let nextRequestId: string | null = null;

    switch (request.type) {
      case "DEVICE_PROCUREMENT": {
        const employee = request.employee;
        if (!employee) throw new Error("Richiesta senza dipendente associato");
        const spec = StepDataSchema.parse(request.planStep?.data ?? {});
        const type = spec.deviceType ?? "LAPTOP";
        const os =
          type === "PHONE"
            ? spec.os === "ANDROID" ? "ANDROID" : "IOS"
            : spec.os === "MACOS" || spec.os === "WINDOWS" ? spec.os : employee.role.defaultOs;
        const catalog = {
          MACOS: { model: "MacBook Pro 14 M4 Pro", prefix: "C02NEW" },
          WINDOWS: { model: "Dell Latitude 7450", prefix: "PF-NEW" },
          IOS: { model: "iPhone 16", prefix: "IPH-NEW" },
          ANDROID: { model: "Samsung Galaxy S25", prefix: "SGS-NEW" },
        } as const;
        const item = catalog[os];
        const device = await tx.device.create({
          data: {
            model: item.model,
            type,
            os,
            ramGb: type === "PHONE" ? 8 : Math.max(spec.minRamGb ?? employee.role.minRamGb, 16),
            serial: `${item.prefix}-${Date.now().toString(36).toUpperCase()}`,
            status: "RESERVED",
            assignedToId: employee.id,
          },
        });
        const setup = await tx.itRequest.create({
          data: {
            type: "DEVICE_SETUP",
            dueDate: request.dueDate,
            employeeId: employee.id,
            deviceId: device.id,
            note: `Preparare ${deviceLabel(device)} per ${employee.firstName} ${employee.lastName}: MDM, account e app del ruolo.`,
          },
        });
        nextRequestId = setup.id;
        outcomes.push(`Registrato ${deviceLabel(device)} e prenotato`);
        break;
      }
      case "LICENSE_SEATS": {
        if (!request.license || !request.employeeId) throw new Error("Richiesta incompleta");
        await tx.license.update({ where: { id: request.license.id }, data: { totalSeats: { increment: 1 } } });
        await tx.licenseAssignment.create({ data: { licenseId: request.license.id, employeeId: request.employeeId } });
        outcomes.push(`Aggiunto 1 posto ${request.license.product} e assegnato`);
        break;
      }
      case "DEVICE_SETUP": {
        if (!request.deviceId) throw new Error("Richiesta incompleta");
        // Se nel frattempo è partita un'uscita il device è già da recuperare: non va riconsegnato
        const { count: handed } = await tx.device.updateMany({
          where: { id: request.deviceId, status: "RESERVED" },
          data: { status: "ASSIGNED" },
        });
        outcomes.push(handed ? "Device preparato e consegnato" : "Device non consegnato: è già in recupero");
        break;
      }
      case "DEVICE_RETURN": {
        if (!request.deviceId) throw new Error("Richiesta incompleta");
        await tx.device.update({ where: { id: request.deviceId }, data: { status: "AVAILABLE", assignedToId: null } });
        outcomes.push("Device rientrato, resettato e tornato disponibile");
        break;
      }
    }

    if (request.planStep) {
      await tx.planStep.update({
        where: { id: request.planStep.id },
        data: nextRequestId
          ? { itRequestId: nextRequestId, detail: "Device acquistato, in preparazione dall'IT" }
          : { status: "DONE", detail: outcomes.join(", "), completedAt: new Date() },
      });
    }
    await tx.auditLog.create({
      data: { actor, action: "it_request.completed", payload: { requestId, type: request.type, outcomes } },
    });
    return { outcomes, planId: request.planStep?.planId, shipmentId: request.shipmentId };
  });

  if (result.shipmentId) await markShipmentDeliveredIfComplete(result.shipmentId);
  if (result.planId) await syncPlanCompletion(result.planId);
  return result.outcomes;
}

const STATUS_IT: Record<DeviceStatus, string> = {
  AVAILABLE: "disponibile",
  RESERVED: "prenotato",
  ASSIGNED: "assegnato",
  TO_RECOVER: "da recuperare",
  IN_REPAIR: "in riparazione",
  RETIRED: "dismesso",
};

const DEVICE_TRANSITIONS: Record<string, DeviceStatus[]> = {
  AVAILABLE: ["IN_REPAIR", "RETIRED"],
  IN_REPAIR: ["AVAILABLE", "RETIRED"],
};

export async function setDeviceStatus(deviceId: string, status: DeviceStatus, actor = "it") {
  const device = await db.device.findUniqueOrThrow({ where: { id: deviceId } });
  if (!DEVICE_TRANSITIONS[device.status]?.includes(status)) {
    throw new Error("Cambio di stato non consentito: il device è assegnato o in un flusso aperto");
  }
  await db.device.update({ where: { id: deviceId }, data: { status } });
  const outcome = `${device.model} (${device.serial}): da ${STATUS_IT[device.status]} a ${STATUS_IT[status]}`;
  await db.auditLog.create({
    data: { actor, action: "device.status_changed", payload: { deviceId, outcomes: [outcome] } },
  });
  return [outcome];
}

export async function createDevice(
  input: { model: string; type: DeviceType; os: Os; ramGb: number; serial: string },
  actor = "it",
) {
  const existing = await db.device.findUnique({ where: { serial: input.serial } });
  if (existing) throw new Error(`Esiste già un device con seriale ${input.serial}`);
  const device = await db.device.create({ data: { ...input, status: "AVAILABLE" } });
  const outcome = `Registrato ${deviceLabel(device)}`;
  await db.auditLog.create({ data: { actor, action: "device.created", payload: { deviceId: device.id, outcomes: [outcome] } } });
  return [outcome];
}

async function usedSeats(licenseId: string) {
  return db.licenseAssignment.count({ where: { licenseId, ...activeAssignmentsWhere() } });
}

export async function trimLicenseSeats(licenseId: string, actor = "it") {
  const license = await db.license.findUniqueOrThrow({ where: { id: licenseId } });
  const used = await usedSeats(licenseId);
  const removed = license.totalSeats - used;
  if (removed <= 0) throw new Error("Nessun posto inutilizzato da rimuovere");
  await db.license.update({ where: { id: licenseId }, data: { totalSeats: used } });
  const saving = removed * Number(license.monthlyCostPerSeat);
  const outcome = `${license.product}: rimossi ${removed} posti inutilizzati, risparmio ${saving.toFixed(2)} €/mese`;
  await db.auditLog.create({ data: { actor, action: "license.trimmed", payload: { licenseId, outcomes: [outcome] } } });
  return [outcome];
}

export async function addLicenseSeat(licenseId: string, actor = "it") {
  const license = await db.license.update({ where: { id: licenseId }, data: { totalSeats: { increment: 1 } } });
  const outcome = `${license.product}: aggiunto 1 posto (totale ${license.totalSeats})`;
  await db.auditLog.create({ data: { actor, action: "license.seat_added", payload: { licenseId, outcomes: [outcome] } } });
  return [outcome];
}

export async function renewLicense(licenseId: string, actor = "it") {
  const license = await db.license.findUniqueOrThrow({ where: { id: licenseId } });
  const next = new Date(Math.max(license.renewalDate.getTime(), Date.now()));
  next.setFullYear(next.getFullYear() + 1);
  await db.license.update({ where: { id: licenseId }, data: { renewalDate: next } });
  const outcome = `${license.product}: rinnovata fino al ${isoDateRome(next)}`;
  await db.auditLog.create({ data: { actor, action: "license.renewed", payload: { licenseId, outcomes: [outcome] } } });
  return [outcome];
}

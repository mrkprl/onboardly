import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { addDocument } from "@/lib/documents";
import { LEAVE_LABEL, createInitialBalances, getBalances, parseDay } from "@/lib/hr";
import { enrollInNextMandatorySessions } from "@/lib/training";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatEuro } from "@/lib/format";
import {
  CARRIER,
  OFFICE_ADDRESS,
  PlanPayloadSchema,
  StepDataSchema,
  deviceLabel,
  freeSeats,
  notBeforeToday,
  parseDate,
  romeDateTime,
  subtractBusinessDays,
  type PlanPayload,
  type StepData,
  type StepKind,
} from "@/lib/plans";
import type { DeviceType, Os, Prisma } from "@/generated/prisma/client";

// Le integrazioni esterne (Google Workspace, mail, Drive) sono simulate: una breve attesa al posto della chiamata API
const SIMULATED_LATENCY_MS = 600;
const simulate = () => new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

type Tx = Prisma.TransactionClient;

export type StepEvent =
  | { type: "step"; stepId: string; status: "RUNNING" | "DONE" | "WAITING_IT" | "FAILED"; detail?: string }
  | { type: "done"; summary: string }
  | { type: "error"; message: string };

type StepResult = { status: "DONE" | "WAITING_IT"; detail: string; itRequestId?: string; data?: StepData };

type Context = {
  planId: string;
  kind: "ONBOARDING" | "OFFBOARDING";
  payload: PlanPayload;
  employeeId: string | null;
};

const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;

async function uniqueEmail(tx: Tx, firstName: string, lastName: string) {
  const base = `${firstName}.${lastName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z.]/g, "");
  for (let i = 1; ; i++) {
    const email = `${base}${i === 1 ? "" : i}@onboardly-demo.test`;
    if (!(await tx.employee.findUnique({ where: { email } }))) return email;
  }
}

function onboardingDue(ctx: Context) {
  const start = parseDate(ctx.payload.candidate!.startDate);
  return {
    setup: notBeforeToday(subtractBusinessDays(start, 1)),
    procurement: notBeforeToday(subtractBusinessDays(start, 3)),
  };
}

async function requestProcurement(
  tx: Tx,
  ctx: Context,
  spec: { type: DeviceType; os?: Os; minRamGb?: number },
  reason: string,
) {
  const employee = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! }, include: { role: true } });
  const what =
    spec.type === "PHONE"
      ? "un telefono aziendale"
      : `un ${spec.os === "MACOS" ? "Mac" : "PC Windows"} con almeno ${spec.minRamGb}GB di RAM`;
  const request = await tx.itRequest.create({
    data: {
      type: "DEVICE_PROCUREMENT",
      dueDate: onboardingDue(ctx).procurement,
      employeeId: employee.id,
      note: `Serve ${what} per ${fullName(employee)} (${employee.role.name}). ${reason}`,
    },
  });
  return request.id;
}

async function runStep(tx: Tx, ctx: Context, kind: StepKind, data: StepData): Promise<StepResult> {
  switch (kind) {
    case "CREATE_EMPLOYEE": {
      const c = ctx.payload.candidate;
      if (!c) throw new Error("Dati del nuovo assunto mancanti");
      const role = await tx.roleProfile.findUniqueOrThrow({ where: { id: c.roleId } });
      const schedule = await tx.workSchedule.findFirst({ orderBy: { weeklyHours: "desc" } });
      const startDate = parseDate(c.startDate);
      const employee = await tx.employee.create({
        data: {
          firstName: c.firstName,
          lastName: c.lastName,
          email: await uniqueEmail(tx, c.firstName, c.lastName),
          team: c.team,
          roleId: c.roleId,
          departmentId: role.departmentId,
          scheduleId: schedule?.id,
          status: "ONBOARDING",
          startDate,
        },
      });
      await createInitialBalances(employee.id, schedule?.weeklyHours ?? 40, startDate, tx);
      await tx.plan.update({ where: { id: ctx.planId }, data: { employeeId: employee.id } });
      ctx.employeeId = employee.id;
      return { status: "DONE", detail: `${employee.email}, ${schedule?.name ?? "orario da definire"}` };
    }

    case "PREPARE_HR_DOCUMENTS": {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! } });
      const docs = [
        { category: "CONTRATTO" as const, title: "Contratto di lavoro indeterminato" },
        { category: "PRIVACY" as const, title: "Informativa privacy dipendenti (art. 13 GDPR)" },
        { category: "REGOLAMENTO" as const, title: "Regolamento aziendale e policy strumenti IT" },
      ];
      for (const doc of docs) {
        await addDocument({ employeeId: employee.id, ...doc, issuedAt: employee.startDate }, "system", tx);
      }
      return { status: "DONE", detail: "3 documenti pronti per la firma" };
    }

    case "ENROLL_SAFETY_TRAINING": {
      const { enrolled, missing } = await enrollInNextMandatorySessions(ctx.employeeId!, tx);
      const parts = [
        enrolled.length ? `Iscritto a: ${enrolled.join(", ")}` : null,
        missing.length ? `Da pianificare: ${missing.join(", ")}` : null,
      ].filter(Boolean);
      return { status: "DONE", detail: parts.join(". ") || "Formazione già in regola" };
    }

    case "SETTLE_LEAVE": {
      const end = parseDay(ctx.payload.endDate!);
      const year = end.getUTCFullYear();
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! } });
      const balances = await getBalances(employee.id, year, tx);
      // La spettanza dell'anno copre i mesi dall'assunzione a dicembre: si liquida solo quanto maturato fino all'uscita
      const firstMonth = employee.startDate.getUTCFullYear() === year ? employee.startDate.getUTCMonth() : 0;
      const share = (end.getUTCMonth() + 1 - firstMonth) / (12 - firstMonth);
      const residual = balances
        .map((b) => ({ type: b.type, hours: Math.round((b.entitled * share + b.carried - b.used) * 10) / 10 }))
        .filter((r) => r.hours > 0)
        .map((r) => `${LEAVE_LABEL[r.type]} ${r.hours.toLocaleString("it-IT")} h`);
      return {
        status: "DONE",
        detail: residual.length
          ? `Maturato al ${formatDate(end)}, da liquidare in busta paga: ${residual.join(", ")}`
          : "Nessun residuo da liquidare",
      };
    }

    case "CANCEL_TRAINING": {
      const { count } = await tx.courseEnrollment.deleteMany({
        where: { employeeId: ctx.employeeId!, session: { completedAt: null, date: { gte: new Date() } } },
      });
      return { status: "DONE", detail: count === 1 ? "1 iscrizione annullata" : `${count} iscrizioni annullate` };
    }

    case "CREATE_ACCOUNTS": {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! } });
      return { status: "DONE", detail: `${data.products?.length ?? 0} account attivi per ${employee.email}` };
    }

    case "ASSIGN_LICENSE":
    case "REQUEST_LICENSE_SEAT": {
      if ((await freeSeats(tx, data.licenseId!)) > 0) {
        await tx.licenseAssignment.create({ data: { licenseId: data.licenseId!, employeeId: ctx.employeeId! } });
        return { status: "DONE" as const, detail: "Posto assegnato" };
      }
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! } });
      const request = await tx.itRequest.create({
        data: {
          type: "LICENSE_SEATS",
          dueDate: onboardingDue(ctx).procurement,
          employeeId: employee.id,
          licenseId: data.licenseId,
          note: `Posti ${data.product} esauriti: aggiungere 1 posto (${formatEuro(data.monthlyCost ?? 0)}/mese) per ${fullName(employee)}.`,
        },
      });
      return { status: "WAITING_IT" as const, detail: "Richiesta posto inviata all'IT", itRequestId: request.id };
    }

    case "RESERVE_DEVICE": {
      const { count } = await tx.device.updateMany({
        where: { id: data.deviceId, status: "AVAILABLE" },
        data: { status: "RESERVED", assignedToId: ctx.employeeId },
      });
      const device = await tx.device.findUniqueOrThrow({ where: { id: data.deviceId } });
      if (count === 0) {
        const spec = { deviceType: device.type, os: device.os, minRamGb: device.ramGb };
        const id = await requestProcurement(
          tx,
          ctx,
          { type: spec.deviceType, os: spec.os, minRamGb: spec.minRamGb },
          "Il device proposto non era più disponibile.",
        );
        return {
          status: "WAITING_IT" as const,
          detail: "Device non più libero: richiesta d'acquisto all'IT",
          itRequestId: id,
          // L'IT registrerà un device con queste caratteristiche: senza, alla chiusura si perderebbe il tipo
          data: { ...data, ...spec },
        };
      }
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! }, include: { role: true } });
      const request = await tx.itRequest.create({
        data: {
          type: "DEVICE_SETUP",
          dueDate: onboardingDue(ctx).setup,
          employeeId: employee.id,
          deviceId: device.id,
          note: `Preparare ${deviceLabel(device)} per ${fullName(employee)}: MDM, account e app del ruolo ${employee.role.name}.`,
        },
      });
      return { status: "WAITING_IT" as const, detail: "Prenotato, in preparazione dall'IT", itRequestId: request.id };
    }

    case "REQUEST_DEVICE": {
      const id = await requestProcurement(
        tx,
        ctx,
        { type: data.deviceType ?? "LAPTOP", os: data.os, minRamGb: data.minRamGb },
        "Nessun device compatibile in magazzino.",
      );
      return { status: "WAITING_IT" as const, detail: "Richiesta d'acquisto inviata all'IT", itRequestId: id };
    }

    case "SEND_WELCOME_EMAIL": {
      return { status: "DONE", detail: "Inviata all'indirizzo personale del nuovo assunto" };
    }

    case "SCHEDULE_SUSPENSION": {
      const endDate = romeDateTime(ctx.payload.endDate!, 18);
      await tx.employee.update({ where: { id: ctx.employeeId! }, data: { status: "OFFBOARDING", endDate } });
      return { status: "DONE", detail: `${data.products?.length ?? 0} account in sospensione programmata` };
    }

    case "TRANSFER_DATA": {
      return { status: "DONE", detail: "Drive trasferito al responsabile del team" };
    }

    case "REVOKE_LICENSE": {
      const endDate = romeDateTime(ctx.payload.endDate!, 18);
      await tx.licenseAssignment.update({ where: { id: data.assignmentId }, data: { revokedAt: endDate } });
      return { status: "DONE", detail: `Libera dal ${formatDate(endDate)} · −${formatEuro(data.monthlyCost ?? 0)}/mese` };
    }

    case "CREATE_SHIPPING_LABEL": {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! } });
      const shipment = await tx.shipment.create({
        data: {
          trackingCode: ctx.payload.trackingCode!,
          confirmToken: ctx.payload.confirmToken ?? randomBytes(16).toString("hex"),
          carrier: CARRIER,
          fromAddress: `${fullName(employee)}, ${employee.address}`,
          toAddress: OFFICE_ADDRESS,
          employeeId: employee.id,
          planId: ctx.planId,
        },
      });
      return { status: "DONE", detail: `Etichetta pronta: ${shipment.trackingCode}` };
    }

    case "RECOVER_DEVICE": {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! } });
      const shipment = await tx.shipment.findUnique({ where: { planId: ctx.planId } });
      const endDate = romeDateTime(ctx.payload.endDate!, 18);
      const due = shipment ? new Date(endDate.getTime() + 5 * 24 * 60 * 60 * 1000) : endDate;
      await tx.device.update({ where: { id: data.deviceId }, data: { status: "TO_RECOVER" } });
      const request = await tx.itRequest.create({
        data: {
          type: "DEVICE_RETURN",
          dueDate: due,
          employeeId: employee.id,
          deviceId: data.deviceId,
          returnMethod: shipment ? "SHIPPING" : "OFFICE",
          shipmentId: shipment?.id,
          note: shipment
            ? `${data.label} in arrivo via corriere da ${fullName(employee)} (tracking ${shipment.trackingCode}). All'arrivo: wipe e rientro in magazzino.`
            : `${fullName(employee)} riconsegna ${data.label} in ufficio entro l'ultimo giorno. Poi wipe e rientro in magazzino.`,
        },
      });
      return {
        status: "WAITING_IT" as const,
        detail: shipment ? "In attesa della spedizione" : "In attesa della riconsegna in ufficio",
        itRequestId: request.id,
      };
    }

    case "SEND_OFFBOARDING_EMAIL": {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! } });
      return { status: "DONE", detail: `Inviata a ${employee.email}` };
    }
  }
}

export async function syncPlanCompletion(planId: string) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId }, include: { steps: true } });
  if (!plan.employeeId || plan.status !== "APPROVED") return;
  if (plan.steps.some((s) => s.status !== "DONE")) return;
  // Solo dallo stato atteso: un ingresso chiuso in ritardo non deve riattivare chi nel frattempo è uscito
  await db.employee.updateMany({
    where: { id: plan.employeeId, status: plan.kind === "ONBOARDING" ? "ONBOARDING" : "OFFBOARDING" },
    data: { status: plan.kind === "ONBOARDING" ? "ACTIVE" : "LEFT" },
  });
}

// Durata del lock di esecuzione, rinnovato a ogni step: se l'esecuzione si interrompe, dopo questo tempo si può riprendere
const LOCK_MS = 60_000;
const SIMULATED_STEPS: StepKind[] = [
  "CREATE_ACCOUNTS",
  "SEND_WELCOME_EMAIL",
  "SCHEDULE_SUSPENSION",
  "TRANSFER_DATA",
  "SEND_OFFBOARDING_EMAIL",
];

const lockUntil = () => new Date(Date.now() + LOCK_MS);

export async function* executePlan(planId: string, actor = "people"): AsyncGenerator<StepEvent> {
  const now = new Date();
  const { count } = await db.plan.updateMany({
    where: {
      id: planId,
      status: { in: ["PROPOSED", "EXECUTING"] },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    data: { status: "EXECUTING", decidedAt: now, lockedUntil: lockUntil() },
  });
  if (count === 0) {
    const current = await db.plan.findUnique({ where: { id: planId }, select: { status: true } });
    yield {
      type: "error",
      message: !current
        ? "Piano non trovato"
        : current.status === "EXECUTING"
          ? "Il piano è già in esecuzione, anche in un'altra finestra"
          : "Il piano è già stato gestito",
    };
    return;
  }

  try {
    const plan = await db.plan.findUniqueOrThrow({
      where: { id: planId },
      include: { steps: { orderBy: { position: "asc" } } },
    });

    if (plan.kind === "OFFBOARDING" && plan.employeeId) {
      const other = await db.plan.findFirst({
        where: { id: { not: planId }, employeeId: plan.employeeId, kind: "OFFBOARDING", status: { in: ["EXECUTING", "APPROVED"] } },
      });
      if (other) {
        await db.plan.update({ where: { id: planId }, data: { status: "PROPOSED", decidedAt: null } });
        yield { type: "error", message: "Per questa persona è già stato eseguito un piano di uscita: rifiuta questo" };
        return;
      }
    }

    const ctx: Context = {
      planId,
      kind: plan.kind,
      payload: PlanPayloadSchema.parse(plan.actions),
      employeeId: plan.employeeId,
    };
    const outcomes: string[] = [];

    for (const step of plan.steps) {
      if (step.status === "DONE" || step.status === "WAITING_IT") continue;
      yield { type: "step", stepId: step.id, status: "RUNNING" };
      try {
        await db.plan.update({ where: { id: planId }, data: { lockedUntil: lockUntil() } });
        const kind = step.kind as StepKind;
        if (SIMULATED_STEPS.includes(kind)) await simulate();
        // Effetto dello step e suo stato nella stessa transazione: se qualcosa fallisce, la ripresa non duplica nulla
        const result = await db.$transaction(async (tx) => {
          const r = await runStep(tx, ctx, kind, StepDataSchema.parse(step.data));
          await tx.planStep.update({
            where: { id: step.id },
            data: {
              status: r.status,
              detail: r.detail,
              itRequestId: r.itRequestId,
              completedAt: r.status === "DONE" ? new Date() : null,
              ...(r.data ? { data: r.data } : {}),
            },
          });
          return r;
        });
        outcomes.push(`${step.label}: ${result.detail}`);
        yield { type: "step", stepId: step.id, status: result.status, detail: result.detail };
      } catch (error) {
        if (step.kind === "CREATE_EMPLOYEE") ctx.employeeId = plan.employeeId;
        const message = errorMessage(error);
        await db.planStep.update({ where: { id: step.id }, data: { status: "FAILED", detail: message } });
        await db.auditLog.create({
          data: { actor: "system", action: "plan.step_failed", payload: { planId, outcomes: [`${step.label}: ${message}`] } },
        });
        yield { type: "step", stepId: step.id, status: "FAILED", detail: message };
        yield { type: "error", message: `Esecuzione interrotta: ${message}. Puoi riprendere dal punto in cui si è fermata.` };
        return;
      }
    }

    await db.plan.update({ where: { id: planId }, data: { status: "APPROVED", lockedUntil: null } });
    await db.auditLog.create({ data: { actor, action: "plan.approved", payload: { planId, kind: plan.kind, outcomes } } });
    await syncPlanCompletion(planId);

    const waiting = await db.planStep.count({ where: { planId, status: "WAITING_IT" } });
    yield {
      type: "done",
      summary: waiting ? `Piano eseguito. ${waiting} step in attesa dell'IT.` : "Piano eseguito, tutto completato.",
    };
  } finally {
    await db.plan.updateMany({ where: { id: planId, status: { in: ["EXECUTING", "PROPOSED"] } }, data: { lockedUntil: null } });
  }
}

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { APP_URL_PLACEHOLDER } from "@/lib/constants";
import { formatDate, isoDateRome } from "@/lib/format";
import type { DeviceType, Os, Prisma } from "@/generated/prisma/client";

const DAY = 24 * 60 * 60 * 1000;

export const OFFICE_ADDRESS = "Onboardly · Ufficio IT, Via dell'Innovazione 12, 20121 Milano (MI)";
export const CARRIER = "OB Express (simulato)";

export const shipmentConfirmPath = (token: string) => `/spedizione/${token}`;

const CandidateSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  team: z.string(),
  roleId: z.string(),
  roleName: z.string(),
  startDate: z.string(),
});

export const PlanPayloadSchema = z.object({
  candidate: CandidateSchema.optional(),
  endDate: z.string().optional(),
  firstWeekPlan: z.string().optional(),
  returnMethod: z.enum(["SHIPPING", "OFFICE"]).optional(),
  trackingCode: z.string().optional(),
  confirmToken: z.string().optional(),
});

export type PlanPayload = z.infer<typeof PlanPayloadSchema>;

export const StepDataSchema = z.object({
  products: z.array(z.string()).optional(),
  licenseId: z.string().optional(),
  assignmentId: z.string().optional(),
  product: z.string().optional(),
  monthlyCost: z.number().optional(),
  deviceId: z.string().optional(),
  deviceIds: z.array(z.string()).optional(),
  deviceType: z.enum(["LAPTOP", "PHONE"]).optional(),
  os: z.enum(["MACOS", "WINDOWS", "IOS", "ANDROID"]).optional(),
  minRamGb: z.number().optional(),
  label: z.string().optional(),
});

export type StepData = z.infer<typeof StepDataSchema>;

export type StepKind =
  | "CREATE_EMPLOYEE"
  | "CREATE_ACCOUNTS"
  | "ASSIGN_LICENSE"
  | "REQUEST_LICENSE_SEAT"
  | "RESERVE_DEVICE"
  | "REQUEST_DEVICE"
  | "SEND_WELCOME_EMAIL"
  | "SCHEDULE_SUSPENSION"
  | "TRANSFER_DATA"
  | "REVOKE_LICENSE"
  | "CREATE_SHIPPING_LABEL"
  | "RECOVER_DEVICE"
  | "SEND_OFFBOARDING_EMAIL"
  | "PREPARE_HR_DOCUMENTS"
  | "ENROLL_SAFETY_TRAINING"
  | "SETTLE_LEAVE"
  | "CANCEL_TRAINING";

type StepDraft = { kind: StepKind; label: string; data: StepData };

type Tx = Prisma.TransactionClient;

const romeHourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" });

// Un orario del giorno YYYY-MM-DD nel fuso italiano, indipendente dal fuso del server (Vercel gira in UTC)
export function romeDateTime(value: string, hour: number) {
  const day = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value) {
    throw new Error(`Data non valida: ${value}`);
  }
  const guess = new Date(day.getTime() + hour * 60 * 60 * 1000);
  const offset = Number(romeHourFormatter.format(guess)) - hour;
  return new Date(guess.getTime() - offset * 60 * 60 * 1000);
}

export const parseDate = (value: string) => romeDateTime(value, 9);

function assertNotPast(value: string, what: string) {
  parseDate(value);
  if (value < isoDateRome()) throw new Error(`La data ${what} (${value}) è nel passato`);
}

export function subtractBusinessDays(date: Date, days: number) {
  const result = new Date(date);
  let left = days;
  while (left > 0) {
    result.setTime(result.getTime() - DAY);
    const weekday = result.getDay();
    if (weekday !== 0 && weekday !== 6) left--;
  }
  return result;
}

export function notBeforeToday(date: Date) {
  const now = new Date();
  return date < now ? now : date;
}

export function activeAssignmentsWhere(now = new Date()): Prisma.LicenseAssignmentWhereInput {
  return { OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] };
}

export async function freeSeats(client: Tx | typeof db, licenseId: string) {
  const license = await client.license.findUniqueOrThrow({ where: { id: licenseId } });
  const used = await client.licenseAssignment.count({ where: { licenseId, ...activeAssignmentsWhere() } });
  return license.totalSeats - used;
}

export async function findAvailableDevice(
  client: Tx | typeof db,
  criteria: { type: DeviceType; os?: Os; minRamGb?: number },
) {
  // I device già proposti in piani non ancora eseguiti non vanno offerti a un altro piano
  const pending = await client.planStep.findMany({
    where: { kind: "RESERVE_DEVICE", status: "PENDING", plan: { status: { in: ["PROPOSED", "EXECUTING"] } } },
    select: { data: true },
  });
  const proposed = pending.map((s) => StepDataSchema.parse(s.data).deviceId).filter((id): id is string => !!id);
  return client.device.findFirst({
    where: {
      status: "AVAILABLE",
      id: { notIn: proposed },
      type: criteria.type,
      ...(criteria.os ? { os: criteria.os } : {}),
      ...(criteria.minRamGb ? { ramGb: { gte: criteria.minRamGb } } : {}),
    },
    orderBy: [{ os: "asc" }, { ramGb: "asc" }, { createdAt: "asc" }],
  });
}

export function deviceLabel(d: { model: string; ramGb: number; serial: string; type: DeviceType }) {
  return d.type === "PHONE" ? `${d.model} (${d.serial})` : `${d.model} ${d.ramGb}GB (${d.serial})`;
}

function sumMonthlyCost(steps: StepDraft[]) {
  return Math.round(steps.reduce((sum, s) => sum + (s.data.monthlyCost ?? 0), 0) * 100) / 100;
}

function trackingCode() {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  return `OBX${digits}IT`;
}

const dateIt = (value: string) =>
  new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(parseDate(value));

async function createPlan(data: {
  kind: "ONBOARDING" | "OFFBOARDING";
  employeeId?: string;
  payload: PlanPayload;
  emailText: string;
  steps: StepDraft[];
}) {
  const plan = await db.plan.create({
    data: {
      kind: data.kind,
      employeeId: data.employeeId,
      actions: data.payload,
      emailText: data.emailText,
      steps: { create: data.steps.map((s, position) => ({ ...s, position })) },
    },
  });
  await db.auditLog.create({
    data: { actor: "agent", action: "plan.proposed", payload: { planId: plan.id, kind: data.kind } },
  });
  return plan;
}

export async function buildOnboardingPlan(input: {
  firstName: string;
  lastName: string;
  team: string;
  roleName: string;
  startDate: string;
  os: Os;
  firstWeekPlan: string;
  welcomeEmail: string;
}) {
  const role = await db.roleProfile.findUnique({
    where: { name: input.roleName },
    include: { licenses: { include: { license: true } } },
  });
  if (!role) throw new Error(`Ruolo sconosciuto: ${input.roleName}`);
  assertNotPast(input.startDate, "di inizio");
  const products = role.licenses.map((l) => l.license.product);

  const steps: StepDraft[] = [
    { kind: "CREATE_EMPLOYEE", label: "Crea anagrafica, email aziendale e saldi ferie/ROL", data: {} },
    { kind: "PREPARE_HR_DOCUMENTS", label: "Prepara contratto, informativa privacy e regolamento", data: {} },
    { kind: "CREATE_ACCOUNTS", label: `Crea account: ${products.join(", ")}`, data: { products } },
  ];

  for (const { license } of role.licenses) {
    const monthlyCost = Number(license.monthlyCostPerSeat);
    const free = await freeSeats(db, license.id);
    steps.push(
      free > 0
        ? {
            kind: "ASSIGN_LICENSE",
            label: `Assegna licenza ${license.product}`,
            data: { licenseId: license.id, product: license.product, monthlyCost },
          }
        : {
            kind: "REQUEST_LICENSE_SEAT",
            label: `${license.product} esaurita: richiedi un posto all'IT`,
            data: { licenseId: license.id, product: license.product, monthlyCost },
          },
    );
  }

  const laptop = await findAvailableDevice(db, { type: "LAPTOP", os: input.os, minRamGb: role.minRamGb });
  steps.push(
    laptop
      ? {
          kind: "RESERVE_DEVICE",
          label: `Prenota ${deviceLabel(laptop)} e fai preparare all'IT`,
          data: { deviceId: laptop.id, label: deviceLabel(laptop) },
        }
      : {
          kind: "REQUEST_DEVICE",
          label: `Nessun ${input.os === "MACOS" ? "Mac" : "PC Windows"} da ${role.minRamGb}GB libero: richiedi l'acquisto all'IT`,
          data: { deviceType: "LAPTOP", os: input.os, minRamGb: role.minRamGb },
        },
  );

  if (role.needsPhone) {
    const phone = await findAvailableDevice(db, { type: "PHONE" });
    steps.push(
      phone
        ? {
            kind: "RESERVE_DEVICE",
            label: `Prenota telefono ${deviceLabel(phone)}`,
            data: { deviceId: phone.id, label: deviceLabel(phone) },
          }
        : { kind: "REQUEST_DEVICE", label: "Nessun telefono libero: richiedi l'acquisto all'IT", data: { deviceType: "PHONE" } },
    );
  }

  steps.push(
    { kind: "ENROLL_SAFETY_TRAINING", label: "Iscrivi ai corsi di sicurezza obbligatori", data: {} },
    { kind: "SEND_WELCOME_EMAIL", label: "Invia mail di benvenuto", data: {} },
  );

  const plan = await createPlan({
    kind: "ONBOARDING",
    payload: {
      candidate: {
        firstName: input.firstName,
        lastName: input.lastName,
        team: input.team,
        roleId: role.id,
        roleName: role.name,
        startDate: input.startDate,
      },
      firstWeekPlan: input.firstWeekPlan,
    },
    emailText: input.welcomeEmail,
    steps,
  });
  return { planId: plan.id, steps: steps.map((s) => s.label), monthlyCost: sumMonthlyCost(steps) };
}

function offboardingEmail(args: {
  firstName: string;
  endDate: string;
  devices: string[];
  method: "SHIPPING" | "OFFICE";
  trackingCode?: string;
  confirmToken?: string;
}) {
  const list = args.devices.map((d) => `- ${d}`).join("\n");
  const intro = `Ciao ${args.firstName},\n\nti confermiamo che il tuo ultimo giorno di lavoro sarà ${dateIt(args.endDate)}. Grazie per tutto il lavoro fatto insieme.`;
  const access = "Gli accessi agli strumenti aziendali resteranno attivi fino alle 18:00 del tuo ultimo giorno.";
  const closing = "Per qualsiasi dubbio scrivici pure.\n\nUn saluto,\nIl team People & Culture";

  if (args.devices.length === 0) return `${intro}\n\n${access}\n\n${closing}`;

  const howTo =
    args.method === "SHIPPING"
      ? `Ti chiediamo di restituire questi dispositivi:\n${list}\n\nIn allegato trovi l'etichetta di spedizione prepagata (${CARRIER}, tracking ${args.trackingCode}): stampala, imballa i dispositivi con i caricabatterie e consegna il pacco al corriere o in un punto di ritiro entro 3 giorni lavorativi dal tuo ultimo giorno.\n\nAppena hai spedito il pacco, segnalacelo da questo link, così aggiorniamo il tracciamento:\n${APP_URL_PLACEHOLDER}${shipmentConfirmPath(args.confirmToken!)}`
      : `Ti chiediamo di riconsegnare questi dispositivi all'ufficio IT (Via dell'Innovazione 12, Milano, reception piano 2):\n${list}\n\nPuoi lasciarli entro il tuo ultimo giorno oppure al primo giorno utile in cui passi in ufficio, insieme ai caricabatterie.`;
  const before =
    "Prima della riconsegna salva i file personali ed esci da tutti gli account. Non resettare i dispositivi: al reset pensiamo noi.";

  return `${intro}\n\n${howTo}\n\n${before}\n\n${access}\n\n${closing}`;
}

export async function buildOffboardingPlan(input: {
  employeeId: string;
  endDate: string;
  returnMethod?: "SHIPPING" | "OFFICE";
}) {
  const employee = await db.employee.findUnique({
    where: { id: input.employeeId },
    include: {
      devices: { where: { status: { in: ["ASSIGNED", "RESERVED"] } }, orderBy: { type: "asc" } },
      licenses: { where: activeAssignmentsWhere(), include: { license: true } },
      enrollments: { where: { session: { completedAt: null, date: { gte: new Date() } } } },
    },
  });
  if (!employee) throw new Error("Dipendente non trovato");
  if (employee.status === "LEFT" || employee.status === "OFFBOARDING") {
    throw new Error(`${employee.firstName} ${employee.lastName} ha già un'uscita in corso o conclusa`);
  }
  const openPlan = await db.plan.findFirst({
    where: { employeeId: employee.id, status: { in: ["PROPOSED", "EXECUTING"] } },
  });
  if (openPlan) {
    throw new Error(
      `${employee.firstName} ${employee.lastName} ha già un piano ${openPlan.kind === "OFFBOARDING" ? "di uscita" : "di ingresso"} da completare: gestisci prima quello`,
    );
  }
  assertNotPast(input.endDate, "di uscita");

  const method = input.returnMethod ?? (employee.workMode === "REMOTE" ? "SHIPPING" : "OFFICE");
  if (method === "SHIPPING" && !employee.address) {
    throw new Error("Manca l'indirizzo del dipendente: non posso generare l'etichetta di spedizione");
  }
  const code = method === "SHIPPING" && employee.devices.length > 0 ? trackingCode() : undefined;
  const confirmToken = code ? randomBytes(16).toString("hex") : undefined;
  const products = employee.licenses.map((a) => a.license.product);

  const steps: StepDraft[] = [
    {
      kind: "SCHEDULE_SUSPENSION",
      label: `Programma la sospensione degli account il ${formatDate(parseDate(input.endDate))} alle 18:00`,
      data: { products },
    },
    { kind: "TRANSFER_DATA", label: "Backup del Drive e trasferimento file al team", data: {} },
    { kind: "SETTLE_LEAVE", label: "Calcola ferie, ROL ed ex festività da liquidare", data: {} },
    ...(employee.enrollments.length > 0
      ? [{ kind: "CANCEL_TRAINING" as const, label: "Annulla le iscrizioni ai corsi futuri", data: {} }]
      : []),
    ...employee.licenses.map(
      (a): StepDraft => ({
        kind: "REVOKE_LICENSE",
        label: `Rilascia licenza ${a.license.product}`,
        data: { assignmentId: a.id, product: a.license.product, monthlyCost: Number(a.license.monthlyCostPerSeat) },
      }),
    ),
  ];

  if (code) {
    steps.push({
      kind: "CREATE_SHIPPING_LABEL",
      label: `Genera etichetta di spedizione ${code}`,
      data: { deviceIds: employee.devices.map((d) => d.id) },
    });
  }
  for (const d of employee.devices) {
    const what = d.type === "PHONE" ? "telefono" : "PC";
    steps.push({
      kind: "RECOVER_DEVICE",
      label:
        method === "SHIPPING"
          ? `Recupera ${what} via corriere: ${deviceLabel(d)}`
          : `Recupera ${what} in ufficio: ${deviceLabel(d)}`,
      data: { deviceId: d.id, label: deviceLabel(d) },
    });
  }
  steps.push({
    kind: "SEND_OFFBOARDING_EMAIL",
    label: code ? "Invia mail di uscita con l'etichetta di spedizione" : "Invia mail di uscita con le istruzioni di riconsegna",
    data: {},
  });

  const plan = await createPlan({
    kind: "OFFBOARDING",
    employeeId: employee.id,
    payload: { endDate: input.endDate, returnMethod: method, trackingCode: code, confirmToken },
    emailText: offboardingEmail({
      firstName: employee.firstName,
      endDate: input.endDate,
      devices: employee.devices.map((d) => deviceLabel(d)),
      method,
      trackingCode: code,
      confirmToken,
    }),
    steps,
  });
  return {
    planId: plan.id,
    employee: `${employee.firstName} ${employee.lastName}`,
    returnMethod: method,
    steps: steps.map((s) => s.label),
    monthlyCost: sumMonthlyCost(steps),
  };
}

export async function rejectPlan(planId: string, actor = "people") {
  // Si può rifiutare un piano proposto, oppure annullare uno rimasto a metà (gli step già eseguiti restano)
  const now = new Date();
  const { count } = await db.plan.updateMany({
    where: {
      id: planId,
      OR: [
        { status: "PROPOSED" },
        { status: "EXECUTING", OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      ],
    },
    data: { status: "REJECTED", decidedAt: now, lockedUntil: null },
  });
  if (count === 0) throw new Error("Il piano è già stato gestito o è in esecuzione");
  await db.auditLog.create({ data: { actor, action: "plan.rejected", payload: { planId } } });
}

import { db } from "@/lib/db";
import type { LeaveType, Prisma } from "@/generated/prisma/client";

// Spettanze annue indicative per un tempo pieno da 40 ore (riferimento CCNL Commercio), riproporzionate sull'orario
export const FULL_TIME_ENTITLEMENT_HOURS = { FERIE: 176, ROL: 72, EX_FESTIVITA: 32 } as const;
export const BALANCE_TYPES = ["FERIE", "ROL", "EX_FESTIVITA"] as const;
export type BalanceType = (typeof BALANCE_TYPES)[number];

export const LEAVE_LABEL: Record<LeaveType, string> = {
  FERIE: "Ferie",
  ROL: "ROL",
  EX_FESTIVITA: "Ex festività",
  MALATTIA: "Malattia",
  PERMESSO_NON_RETRIBUITO: "Permesso non retribuito",
};

const DAY = 24 * 60 * 60 * 1000;

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function italianHolidays(year: number) {
  const fixed = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"];
  const easterMonday = new Date(easterSunday(year).getTime() + DAY);
  return new Set([...fixed.map((md) => `${year}-${md}`), dayKey(easterMonday)]);
}

// Le date delle assenze sono salvate a mezzanotte UTC: si lavora sempre sui componenti UTC
function utcDate(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const parseDay = (value: string) => new Date(`${value}T00:00:00.000Z`);

export function workingDaysBetween(start: Date, end: Date) {
  const from = utcDate(start);
  const to = utcDate(end);
  if (to < from) return 0;
  const holidays = new Map<number, Set<string>>();
  let count = 0;
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const d = new Date(t);
    const weekday = d.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const year = d.getUTCFullYear();
    if (!holidays.has(year)) holidays.set(year, italianHolidays(year));
    if (holidays.get(year)!.has(dayKey(d))) continue;
    count++;
  }
  return count;
}

export const dailyHours = (weeklyHours: number) => weeklyHours / 5;

export function entitlementFor(type: BalanceType, weeklyHours: number) {
  return Math.round(FULL_TIME_ENTITLEMENT_HOURS[type] * (weeklyHours / 40) * 100) / 100;
}

type Tx = Prisma.TransactionClient;

export type BalanceRow = {
  type: BalanceType;
  entitled: number;
  carried: number;
  used: number;
  pending: number;
  remaining: number;
};

export async function getBalances(employeeId: string, year: number, client: Tx | typeof db = db) {
  const [balances, requests] = await Promise.all([
    client.leaveBalance.findMany({ where: { employeeId, year } }),
    client.leaveRequest.findMany({
      where: {
        employeeId,
        type: { in: [...BALANCE_TYPES] },
        status: { in: ["APPROVED", "PENDING"] },
        startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
    }),
  ]);

  return BALANCE_TYPES.map((type): BalanceRow => {
    const balance = balances.find((b) => b.type === type);
    const entitled = Number(balance?.entitledHours ?? 0);
    const carried = Number(balance?.carriedHours ?? 0);
    const ofType = requests.filter((r) => r.type === type);
    const used = ofType.filter((r) => r.status === "APPROVED").reduce((s, r) => s + Number(r.hours), 0);
    const pending = ofType.filter((r) => r.status === "PENDING").reduce((s, r) => s + Number(r.hours), 0);
    return { type, entitled, carried, used, pending, remaining: entitled + carried - used - pending };
  });
}

export async function createInitialBalances(
  employeeId: string,
  weeklyHours: number,
  startDate: Date,
  client: Tx | typeof db = db,
) {
  const year = startDate.getFullYear();
  // Maturazione proporzionale ai mesi residui dell'anno di assunzione
  const monthsLeft = 12 - startDate.getMonth();
  await client.leaveBalance.createMany({
    data: BALANCE_TYPES.map((type) => ({
      employeeId,
      year,
      type,
      entitledHours: Math.round(((entitlementFor(type, weeklyHours) * monthsLeft) / 12) * 100) / 100,
    })),
    skipDuplicates: true,
  });
}

export async function createLeaveRequest(input: {
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  hours?: number;
  note?: string | null;
  actor?: string;
}) {
  if (input.endDate < input.startDate) throw new Error("La data di fine precede quella di inizio");
  const employee = await db.employee.findUniqueOrThrow({ where: { id: input.employeeId }, include: { schedule: true } });
  const weeklyHours = employee.schedule?.weeklyHours ?? 40;
  const days = workingDaysBetween(input.startDate, input.endDate);
  if (days === 0) throw new Error("Il periodo non contiene giorni lavorativi");
  const hours = input.hours ?? days * dailyHours(weeklyHours);
  if (hours <= 0) throw new Error("Le ore devono essere maggiori di zero");
  if (input.hours && input.hours > days * dailyHours(weeklyHours)) {
    throw new Error("Le ore superano l'orario previsto nel periodo");
  }

  const overlap = await db.leaveRequest.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
    },
  });
  if (overlap) throw new Error("Esiste già una richiesta nello stesso periodo");

  if ((BALANCE_TYPES as readonly string[]).includes(input.type)) {
    const balances = await getBalances(input.employeeId, input.startDate.getUTCFullYear());
    const row = balances.find((b) => b.type === input.type)!;
    if (row.remaining < hours) {
      throw new Error(`Saldo ${LEAVE_LABEL[input.type]} insufficiente: restano ${row.remaining.toFixed(1)} ore`);
    }
  }

  const request = await db.leaveRequest.create({
    data: {
      employeeId: input.employeeId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      hours,
      note: input.note ?? null,
      status: input.type === "MALATTIA" ? "APPROVED" : "PENDING",
      decidedAt: input.type === "MALATTIA" ? new Date() : null,
    },
  });
  await db.auditLog.create({
    data: {
      actor: input.actor ?? "people",
      action: "leave.requested",
      payload: {
        requestId: request.id,
        outcomes: [`${employee.firstName} ${employee.lastName}: ${LEAVE_LABEL[input.type]}, ${hours} ore`],
      },
    },
  });
  return request;
}

export async function decideLeaveRequest(requestId: string, approve: boolean, actor = "people") {
  const request = await db.leaveRequest.findUniqueOrThrow({ where: { id: requestId }, include: { employee: true } });
  const { count } = await db.leaveRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: approve ? "APPROVED" : "REJECTED", decidedAt: new Date() },
  });
  if (count === 0) throw new Error("La richiesta è già stata gestita");
  await db.auditLog.create({
    data: {
      actor,
      action: approve ? "leave.approved" : "leave.rejected",
      payload: {
        requestId,
        outcomes: [
          `${request.employee.firstName} ${request.employee.lastName}: ${LEAVE_LABEL[request.type]} ${approve ? "approvate" : "rifiutate"} (${Number(request.hours)} ore)`,
        ],
      },
    },
  });
}

export async function absencesBetween(from: Date, to: Date, departmentId?: string) {
  return db.leaveRequest.findMany({
    where: {
      status: { in: ["APPROVED", "PENDING"] },
      startDate: { lte: to },
      endDate: { gte: from },
      ...(departmentId ? { employee: { departmentId } } : {}),
    },
    include: { employee: { include: { department: true } } },
    orderBy: { startDate: "asc" },
  });
}

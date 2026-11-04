import { config } from "dotenv";

config({ path: ".env.local" });

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);
// Giorno a mezzanotte UTC, relativo a oggi (date delle assenze)
// Aritmetica sul calendario: sommare millisecondi sbaglia giorno al cambio dell'ora legale
const utcDay = (offsetDays: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays));
};
const monthsAgo = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setHours(9, 0, 0, 0);
  return d;
};
const YEAR = new Date().getFullYear();

const LICENSES = [
  { product: "Google Workspace", totalSeats: 18, monthlyCostPerSeat: 14, renewalDays: 120 },
  { product: "Slack", totalSeats: 18, monthlyCostPerSeat: 8.75, renewalDays: 45 },
  { product: "1Password", totalSeats: 18, monthlyCostPerSeat: 7.5, renewalDays: 160 },
  { product: "Zoom", totalSeats: 10, monthlyCostPerSeat: 13, renewalDays: 95 },
  { product: "Notion", totalSeats: 12, monthlyCostPerSeat: 10, renewalDays: 20 },
  { product: "GitHub", totalSeats: 6, monthlyCostPerSeat: 21, renewalDays: 200 },
  { product: "Linear", totalSeats: 8, monthlyCostPerSeat: 8, renewalDays: 55 },
  { product: "Sentry", totalSeats: 8, monthlyCostPerSeat: 26, renewalDays: 140 },
  { product: "Figma", totalSeats: 2, monthlyCostPerSeat: 16, renewalDays: 75 },
  { product: "Miro", totalSeats: 5, monthlyCostPerSeat: 10, renewalDays: 65 },
  { product: "Adobe Creative Cloud", totalSeats: 3, monthlyCostPerSeat: 65, renewalDays: 28 },
  { product: "HubSpot", totalSeats: 8, monthlyCostPerSeat: 90, renewalDays: 12 },
  { product: "Intercom", totalSeats: 4, monthlyCostPerSeat: 39, renewalDays: 180 },
  { product: "Personio", totalSeats: 3, monthlyCostPerSeat: 9, renewalDays: 30 },
  { product: "Canva", totalSeats: 5, monthlyCostPerSeat: 12, renewalDays: 240 },
  { product: "Loom", totalSeats: 5, monthlyCostPerSeat: 15, renewalDays: 18 },
];

const DEPARTMENTS = [
  { code: "IT", name: "IT" },
  { code: "PRODUCT", name: "Prodotto" },
  { code: "SALES", name: "Sales" },
  { code: "CS", name: "Customer Success" },
  { code: "PEOPLE", name: "People & Culture" },
] as const;

const SCHEDULES = [
  { name: "Tempo pieno 40h", weeklyHours: 40, description: "Lunedì-venerdì 9:00-18:00, pausa 13:00-14:00" },
  { name: "Part-time 30h", weeklyHours: 30, description: "Lunedì-venerdì 9:00-15:00" },
  { name: "Part-time 20h", weeklyHours: 20, description: "Lunedì-venerdì 9:00-13:00" },
] as const;

const BASE_LICENSES = ["Google Workspace", "Slack", "1Password"] as const;

const ROLES = [
  { name: "Software Engineer", department: "IT", defaultOs: "MACOS", minRamGb: 32, licenses: [...BASE_LICENSES, "Notion", "GitHub", "Linear", "Sentry"] },
  { name: "Product Designer", department: "PRODUCT", defaultOs: "MACOS", minRamGb: 16, licenses: [...BASE_LICENSES, "Notion", "Linear", "Figma", "Miro", "Adobe Creative Cloud"] },
  { name: "Customer Success", department: "CS", defaultOs: "WINDOWS", minRamGb: 16, needsPhone: true, licenses: [...BASE_LICENSES, "Zoom", "HubSpot", "Intercom"] },
  { name: "People Specialist", department: "PEOPLE", defaultOs: "MACOS", minRamGb: 16, needsPhone: true, licenses: [...BASE_LICENSES, "Zoom", "Notion", "Personio", "Canva"] },
  { name: "Account Executive", department: "SALES", defaultOs: "WINDOWS", minRamGb: 16, needsPhone: true, licenses: [...BASE_LICENSES, "Zoom", "HubSpot"] },
] as const;

type SafetyRole = "FIRST_AID" | "FIRE_WARDEN" | "PREPOSTO" | "RLS";

type EmployeeSeed = {
  firstName: string;
  lastName: string;
  team: string;
  role: (typeof ROLES)[number]["name"];
  device: string;
  phoneDevice?: string;
  workMode: "OFFICE" | "REMOTE";
  address: string;
  hired: string;
  schedule?: (typeof SCHEDULES)[number]["name"];
  contract?: "INDETERMINATO" | "DETERMINATO" | "APPRENDISTATO";
  contractEndMonths?: number;
  level: string;
  safetyRoles?: SafetyRole[];
  // Mesi trascorsi dall'ultimo corso specifico; null = mai fatto
  specMonthsAgo?: number | null;
  medicalMonthsAgo?: number;
};

const EMPLOYEES: EmployeeSeed[] = [
  { firstName: "Luca", lastName: "Bianchi", team: "Platform", role: "Software Engineer", device: "C02MBP32A", workMode: "OFFICE", address: "Via Paolo Sarpi 18, 20154 Milano (MI)", hired: "2021-03-01", level: "1° livello", safetyRoles: ["FIRE_WARDEN"], specMonthsAgo: 59, medicalMonthsAgo: 30 },
  { firstName: "Sara", lastName: "Conti", team: "Platform", role: "Software Engineer", device: "C02MBP32B", workMode: "OFFICE", address: "Viale Monza 77, 20125 Milano (MI)", hired: "2020-09-14", level: "Quadro", safetyRoles: ["PREPOSTO"], specMonthsAgo: 62, medicalMonthsAgo: 40 },
  { firstName: "Davide", lastName: "Romano", team: "Growth", role: "Software Engineer", device: "C02MBP32C", workMode: "REMOTE", address: "Via San Donato 41, 10144 Torino (TO)", hired: "2020-06-01", level: "1° livello", specMonthsAgo: 63, medicalMonthsAgo: 61 },
  { firstName: "Elena", lastName: "Galli", team: "Growth", role: "Software Engineer", device: "C02MBP32D", workMode: "OFFICE", address: "Via Tortona 9, 20144 Milano (MI)", hired: "2025-02-03", contract: "APPRENDISTATO", level: "3° livello" },
  { firstName: "Chiara", lastName: "Ferri", team: "Growth", role: "Product Designer", device: "C02MBA16A", workMode: "OFFICE", address: "Corso Lodi 22, 20135 Milano (MI)", hired: "2022-01-10", level: "2° livello", safetyRoles: ["RLS"] },
  { firstName: "Paolo", lastName: "Marino", team: "Platform", role: "Product Designer", device: "C02MBA16B", workMode: "REMOTE", address: "Via Santo Stefano 60, 40125 Bologna (BO)", hired: "2023-05-15", level: "2° livello" },
  { firstName: "Giorgia", lastName: "Costa", team: "Customer", role: "Customer Success", device: "PF-TP14-001", phoneDevice: "IPH-15-001", workMode: "OFFICE", address: "Via Padova 130, 20127 Milano (MI)", hired: "2022-09-05", level: "3° livello", safetyRoles: ["FIRST_AID"] },
  { firstName: "Andrea", lastName: "Greco", team: "Customer", role: "Customer Success", device: "PF-TP14-002", phoneDevice: "IPH-15-002", workMode: "REMOTE", address: "Via Mazzini 14, 40137 Bologna (BO)", hired: "2021-10-18", level: "3° livello", specMonthsAgo: 59 },
  { firstName: "Martina", lastName: "Riva", team: "Customer", role: "Customer Success", device: "PF-TP14-003", phoneDevice: "IPH-15-003", workMode: "OFFICE", address: "Via Savona 33, 20144 Milano (MI)", hired: "2019-04-01", schedule: "Part-time 30h", level: "3° livello", safetyRoles: ["FIRE_WARDEN"], medicalMonthsAgo: 59 },
  { firstName: "Laura", lastName: "Moretti", team: "Customer", role: "Customer Success", device: "PF-LAT-001", phoneDevice: "SGS-24-001", workMode: "REMOTE", address: "Via dei Mille 5, 80121 Napoli (NA)", hired: "2024-03-04", level: "4° livello" },
  { firstName: "Simone", lastName: "Fontana", team: "Platform", role: "Software Engineer", device: "C02MBP48A", workMode: "OFFICE", address: "Via Vigevano 3, 20144 Milano (MI)", hired: "2025-12-01", contract: "DETERMINATO", contractEndMonths: 2, level: "2° livello" },
  { firstName: "Francesca", lastName: "Leone", team: "People & Culture", role: "People Specialist", device: "C02MBA16C", phoneDevice: "IPH-15-004", workMode: "OFFICE", address: "Via Plinio 21, 20129 Milano (MI)", hired: "2021-07-12", level: "2° livello", safetyRoles: ["FIRST_AID"] },
  { firstName: "Matteo", lastName: "Rizzi", team: "People & Culture", role: "People Specialist", device: "C02MBA16E", phoneDevice: "IPH-15-005", workMode: "REMOTE", address: "Borgo Pinti 50, 50121 Firenze (FI)", hired: "2024-11-11", schedule: "Part-time 20h", level: "4° livello" },
  { firstName: "Federica", lastName: "Sala", team: "Enterprise", role: "Account Executive", device: "PF-TP14-005", phoneDevice: "IPH-15-007", workMode: "OFFICE", address: "Via Washington 40, 20146 Milano (MI)", hired: "2023-02-01", level: "1° livello", safetyRoles: ["PREPOSTO"] },
  { firstName: "Giacomo", lastName: "Barbieri", team: "Mid-market", role: "Account Executive", device: "PF-TP14-006", phoneDevice: "IPH-15-008", workMode: "REMOTE", address: "Via Merulana 88, 00185 Roma (RM)", hired: "2026-09-28", level: "3° livello", specMonthsAgo: null },
  { firstName: "Alessia", lastName: "Pellegrini", team: "Mid-market", role: "Account Executive", device: "C02MBA16G", phoneDevice: "IPH-15-009", workMode: "OFFICE", address: "Via Ripamonti 19, 20136 Milano (MI)", hired: "2026-10-05", schedule: "Part-time 30h", contract: "DETERMINATO", contractEndMonths: 11, level: "4° livello", specMonthsAgo: null },
];

const DEVICES = [
  { serial: "C02MBP32A", model: "MacBook Pro 14 M4 Pro", os: "MACOS", ramGb: 32 },
  { serial: "C02MBP32B", model: "MacBook Pro 14 M4 Pro", os: "MACOS", ramGb: 32 },
  { serial: "C02MBP32C", model: "MacBook Pro 14 M4 Pro", os: "MACOS", ramGb: 32 },
  { serial: "C02MBP32D", model: "MacBook Pro 14 M4 Pro", os: "MACOS", ramGb: 32 },
  { serial: "C02MBP32E", model: "MacBook Pro 14 M3 Pro", os: "MACOS", ramGb: 32, status: "IN_REPAIR" },
  { serial: "C02MBA16A", model: "MacBook Air 13 M4", os: "MACOS", ramGb: 16 },
  { serial: "C02MBA16B", model: "MacBook Air 13 M4", os: "MACOS", ramGb: 16 },
  { serial: "C02MBA16C", model: "MacBook Air 13 M3", os: "MACOS", ramGb: 16 },
  { serial: "C02MBA16D", model: "MacBook Air 13 M4", os: "MACOS", ramGb: 16, status: "AVAILABLE" },
  { serial: "C02MBA16G", model: "MacBook Air 13 M4", os: "MACOS", ramGb: 16 },
  { serial: "PF-TP14-001", model: "Lenovo ThinkPad T14 Gen 5", os: "WINDOWS", ramGb: 16 },
  { serial: "PF-TP14-002", model: "Lenovo ThinkPad T14 Gen 5", os: "WINDOWS", ramGb: 16 },
  { serial: "PF-TP14-003", model: "Lenovo ThinkPad T14 Gen 5", os: "WINDOWS", ramGb: 16 },
  { serial: "PF-TP14-004", model: "Lenovo ThinkPad T14 Gen 5", os: "WINDOWS", ramGb: 16, status: "AVAILABLE" },
  { serial: "PF-TP14-005", model: "Lenovo ThinkPad T14 Gen 5", os: "WINDOWS", ramGb: 16 },
  { serial: "PF-TP14-006", model: "Lenovo ThinkPad T14 Gen 5", os: "WINDOWS", ramGb: 16 },
  { serial: "PF-X1-001", model: "Lenovo ThinkPad X1 Carbon Gen 9", os: "WINDOWS", ramGb: 8, status: "RETIRED" },
  { serial: "C02MBP48A", model: "MacBook Pro 16 M4 Max", os: "MACOS", ramGb: 48 },
  { serial: "C02MBA16E", model: "MacBook Air 15 M4", os: "MACOS", ramGb: 16 },
  { serial: "C02MBA15F", model: "MacBook Air 15 M4", os: "MACOS", ramGb: 16, status: "AVAILABLE" },
  { serial: "C02MBA08A", model: "MacBook Air 13 M2", os: "MACOS", ramGb: 8, status: "AVAILABLE" },
  { serial: "C02MBP16A", model: "MacBook Pro 14 M1 Pro", os: "MACOS", ramGb: 16, status: "IN_REPAIR" },
  { serial: "C02MBP08A", model: "MacBook Pro 13 M1", os: "MACOS", ramGb: 8, status: "RETIRED" },
  { serial: "PF-LAT-001", model: "Dell Latitude 5450", os: "WINDOWS", ramGb: 16 },
  { serial: "PF-LAT-002", model: "Dell Latitude 7450", os: "WINDOWS", ramGb: 32, status: "AVAILABLE" },
  { serial: "PF-LAT-003", model: "Dell Latitude 5450", os: "WINDOWS", ramGb: 16, status: "AVAILABLE" },
  { serial: "PF-HP-001", model: "HP EliteBook 840 G11", os: "WINDOWS", ramGb: 16, status: "IN_REPAIR" },
  { serial: "PF-SFC-001", model: "Microsoft Surface Laptop 5", os: "WINDOWS", ramGb: 8, status: "RETIRED" },
  { serial: "IPH-15-001", model: "iPhone 15", type: "PHONE", os: "IOS", ramGb: 6 },
  { serial: "IPH-15-002", model: "iPhone 15", type: "PHONE", os: "IOS", ramGb: 6 },
  { serial: "IPH-15-003", model: "iPhone 15", type: "PHONE", os: "IOS", ramGb: 6 },
  { serial: "IPH-15-004", model: "iPhone 15", type: "PHONE", os: "IOS", ramGb: 6 },
  { serial: "IPH-15-005", model: "iPhone 15", type: "PHONE", os: "IOS", ramGb: 6 },
  { serial: "IPH-15-007", model: "iPhone 15", type: "PHONE", os: "IOS", ramGb: 6 },
  { serial: "IPH-15-008", model: "iPhone 15", type: "PHONE", os: "IOS", ramGb: 6 },
  { serial: "IPH-15-009", model: "iPhone 15", type: "PHONE", os: "IOS", ramGb: 6 },
  { serial: "SGS-24-001", model: "Samsung Galaxy S24", type: "PHONE", os: "ANDROID", ramGb: 8 },
  { serial: "IPH-15-006", model: "iPhone 15", type: "PHONE", os: "IOS", ramGb: 6, status: "AVAILABLE" },
  { serial: "SGS-24-002", model: "Samsung Galaxy S24", type: "PHONE", os: "ANDROID", ramGb: 8, status: "AVAILABLE" },
  { serial: "IPH-13-001", model: "iPhone 13", type: "PHONE", os: "IOS", ramGb: 4, status: "IN_REPAIR" },
] as const;

// Catalogo indicativo (D.Lgs. 81/2008, accordi Stato-Regioni): durate e periodicità da verificare con l'RSPP
const COURSES = [
  { code: "SIC-GEN", title: "Formazione generale lavoratori", description: "Concetti di rischio, danno, prevenzione, organizzazione della sicurezza, diritti e doveri.", audience: "ALL", hours: 4, validityMonths: null },
  { code: "SIC-SPEC-B", title: "Formazione specifica rischio basso", description: "Rischi specifici del lavoro d'ufficio: videoterminali, ergonomia, stress lavoro-correlato, emergenze.", audience: "ALL", hours: 4, validityMonths: 60 },
  { code: "SIC-SPEC-AGG", title: "Aggiornamento formazione specifica", description: "Aggiornamento quinquennale della formazione specifica dei lavoratori.", audience: "ALL", hours: 6, validityMonths: 60, renews: "SIC-SPEC-B" },
  { code: "PS-BC", title: "Primo soccorso (gruppo B/C)", description: "Riconoscere un'emergenza sanitaria, attivare i soccorsi, interventi di primo soccorso.", audience: "FIRST_AID", hours: 12, validityMonths: 36 },
  { code: "PS-AGG", title: "Aggiornamento primo soccorso", description: "Aggiornamento triennale della parte pratica.", audience: "FIRST_AID", hours: 4, validityMonths: 36, renews: "PS-BC" },
  { code: "AI-L1", title: "Antincendio livello 1", description: "Prevenzione incendi, uso degli estintori, procedure di evacuazione per attività a rischio basso.", audience: "FIRE_WARDEN", hours: 4, validityMonths: 60 },
  { code: "AI-L1-AGG", title: "Aggiornamento antincendio livello 1", description: "Aggiornamento quinquennale con esercitazione pratica.", audience: "FIRE_WARDEN", hours: 2, validityMonths: 60, renews: "AI-L1" },
  { code: "PREP", title: "Formazione preposto", description: "Ruolo del preposto, vigilanza, segnalazione delle non conformità.", audience: "PREPOSTO", hours: 12, validityMonths: 24 },
  { code: "PREP-AGG", title: "Aggiornamento preposto", description: "Aggiornamento biennale del preposto.", audience: "PREPOSTO", hours: 6, validityMonths: 24, renews: "PREP" },
  { code: "RLS", title: "Rappresentante dei lavoratori per la sicurezza", description: "Formazione iniziale dell'RLS.", audience: "RLS", hours: 32, validityMonths: 12 },
  { code: "RLS-AGG", title: "Aggiornamento RLS", description: "Aggiornamento annuale dell'RLS.", audience: "RLS", hours: 4, validityMonths: 12, renews: "RLS" },
] as const;

// Ultimo corso per ruolo di sicurezza: mesi trascorsi
const ROLE_TRAINING: Record<string, Partial<Record<SafetyRole, number>>> = {
  Bianchi: { FIRE_WARDEN: 20 },
  Conti: { PREPOSTO: 26 },
  Ferri: { RLS: 11 },
  Costa: { FIRST_AID: 10 },
  Riva: { FIRE_WARDEN: 64 },
  Leone: { FIRST_AID: 35 },
  Sala: { PREPOSTO: 6 },
};
const ROLE_COURSE: Record<SafetyRole, string> = { FIRST_AID: "PS-BC", FIRE_WARDEN: "AI-L1", PREPOSTO: "PREP", RLS: "RLS" };

const PROVIDERS = ["Ente formativo Sicurezza Lavoro Milano", "Studio RSPP Bertolini", "Croce Verde Formazione"];

async function main() {
  const { db } = await import("../src/lib/db");
  const { workingDaysBetween, entitlementFor, BALANCE_TYPES } = await import("../src/lib/hr");

  await db.auditLog.deleteMany();
  await db.planStep.deleteMany();
  await db.itRequest.deleteMany();
  await db.shipment.deleteMany();
  await db.plan.deleteMany();
  await db.document.deleteMany();
  await db.courseEnrollment.deleteMany();
  await db.courseCompletion.deleteMany();
  await db.courseSession.deleteMany();
  await db.course.deleteMany({ where: { renewsCourseId: { not: null } } });
  await db.course.deleteMany();
  await db.leaveRequest.deleteMany();
  await db.leaveBalance.deleteMany();
  await db.licenseAssignment.deleteMany();
  await db.device.deleteMany();
  await db.employee.deleteMany();
  await db.roleLicense.deleteMany();
  await db.roleProfile.deleteMany();
  await db.workSchedule.deleteMany();
  await db.department.deleteMany();
  await db.license.deleteMany();

  const licenses = new Map<string, string>();
  for (const l of LICENSES) {
    const created = await db.license.create({
      data: {
        product: l.product,
        totalSeats: l.totalSeats,
        monthlyCostPerSeat: l.monthlyCostPerSeat,
        renewalDate: daysFromNow(l.renewalDays),
      },
    });
    licenses.set(l.product, created.id);
  }

  const departments = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    departments.set(d.code, (await db.department.create({ data: d })).id);
  }

  const schedules = new Map<string, { id: string; weeklyHours: number }>();
  for (const s of SCHEDULES) {
    const created = await db.workSchedule.create({ data: s });
    schedules.set(s.name, { id: created.id, weeklyHours: s.weeklyHours });
  }

  const roles = new Map<string, { id: string; departmentId: string; licenses: readonly string[] }>();
  for (const r of ROLES) {
    const created = await db.roleProfile.create({
      data: {
        name: r.name,
        departmentId: departments.get(r.department)!,
        defaultOs: r.defaultOs,
        minRamGb: r.minRamGb,
        needsPhone: "needsPhone" in r ? r.needsPhone : false,
        licenses: { create: r.licenses.map((p) => ({ licenseId: licenses.get(p)! })) },
      },
    });
    roles.set(r.name, { id: created.id, departmentId: created.departmentId!, licenses: r.licenses });
  }

  const courses = new Map<string, { id: string; validityMonths: number | null }>();
  for (const c of COURSES.filter((c) => !("renews" in c))) {
    const { code, title, description, audience, hours, validityMonths } = c;
    const created = await db.course.create({ data: { code, title, description, audience, hours, validityMonths } });
    courses.set(code, { id: created.id, validityMonths });
  }
  for (const c of COURSES.filter((c) => "renews" in c)) {
    const { code, title, description, audience, hours, validityMonths } = c;
    const renews = "renews" in c ? c.renews : "";
    const created = await db.course.create({
      data: { code, title, description, audience, hours, validityMonths, renewsCourseId: courses.get(renews)!.id },
    });
    courses.set(code, { id: created.id, validityMonths });
  }

  const deviceOwners = new Map<string, string>();
  const employees: { id: string; seed: EmployeeSeed; weeklyHours: number }[] = [];
  for (const e of EMPLOYEES) {
    const role = roles.get(e.role)!;
    const schedule = schedules.get(e.schedule ?? "Tempo pieno 40h")!;
    const hiredAt = new Date(`${e.hired}T09:00:00`);
    const recent = Date.now() - hiredAt.getTime() < 60 * DAY;
    const employee = await db.employee.create({
      data: {
        firstName: e.firstName,
        lastName: e.lastName,
        email: `${e.firstName}.${e.lastName}@onboardly-demo.test`.toLowerCase(),
        team: e.team,
        roleId: role.id,
        departmentId: role.departmentId,
        scheduleId: schedule.id,
        contractType: e.contract ?? "INDETERMINATO",
        contractLevel: `${e.level} CCNL Commercio`,
        contractEnd: e.contractEndMonths ? daysFromNow(e.contractEndMonths * 30) : null,
        safetyRoles: e.safetyRoles ?? [],
        status: recent ? "ONBOARDING" : "ACTIVE",
        workMode: e.workMode,
        address: e.address,
        startDate: hiredAt,
        licenses: { create: role.licenses.map((p) => ({ licenseId: licenses.get(p)! })) },
      },
    });
    employees.push({ id: employee.id, seed: e, weeklyHours: schedule.weeklyHours });
    deviceOwners.set(e.device, employee.id);
    if (e.phoneDevice) deviceOwners.set(e.phoneDevice, employee.id);
  }

  for (const d of DEVICES) {
    const ownerId = deviceOwners.get(d.serial);
    await db.device.create({
      data: {
        serial: d.serial,
        model: d.model,
        type: "type" in d ? d.type : "LAPTOP",
        os: d.os,
        ramGb: d.ramGb,
        status: ownerId ? "ASSIGNED" : "status" in d ? d.status : "AVAILABLE",
        assignedToId: ownerId ?? null,
      },
    });
  }

  // Saldi dell'anno corrente, con residuo dall'anno precedente
  for (const [i, { id, seed, weeklyHours }] of employees.entries()) {
    const hiredThisYear = new Date(seed.hired).getFullYear() === YEAR;
    const monthsLeft = hiredThisYear ? 12 - new Date(seed.hired).getMonth() : 12;
    await db.leaveBalance.createMany({
      data: BALANCE_TYPES.map((type) => ({
        employeeId: id,
        year: YEAR,
        type,
        entitledHours: Math.round(((entitlementFor(type, weeklyHours) * monthsLeft) / 12) * 100) / 100,
        carriedHours: hiredThisYear ? 0 : type === "FERIE" ? (i * 13) % 48 : type === "ROL" ? (i * 5) % 20 : 0,
      })),
    });
  }

  const byLast = (lastName: string) => employees.find((e) => e.seed.lastName === lastName)!;
  const leave = async (
    lastName: string,
    type: "FERIE" | "ROL" | "EX_FESTIVITA" | "MALATTIA" | "PERMESSO_NON_RETRIBUITO",
    start: Date,
    end: Date,
    status: "APPROVED" | "PENDING" | "REJECTED",
    hours?: number,
    note?: string,
  ) => {
    const e = byLast(lastName);
    const total = hours ?? workingDaysBetween(start, end) * (e.weeklyHours / 5);
    await db.leaveRequest.create({
      data: {
        employeeId: e.id,
        type,
        startDate: start,
        endDate: end,
        hours: total,
        status,
        note: note ?? null,
        decidedAt: status === "PENDING" ? null : new Date(start.getTime() - 20 * DAY),
      },
    });
  };
  const aug = (day: number) => new Date(Date.UTC(YEAR, 7, day));

  // Estate: ferie già godute
  for (const [lastName, from, to] of [
    ["Bianchi", 3, 21], ["Conti", 10, 28], ["Romano", 3, 14], ["Galli", 17, 28], ["Ferri", 10, 21],
    ["Marino", 3, 14], ["Costa", 10, 21], ["Greco", 17, 28], ["Riva", 3, 21], ["Moretti", 10, 21],
    ["Leone", 3, 14], ["Rizzi", 17, 21], ["Sala", 10, 21], ["Fontana", 24, 28],
  ] as const) {
    await leave(lastName, "FERIE", aug(from), aug(to), "APPROVED");
  }
  // Recenti e in arrivo
  await leave("Riva", "MALATTIA", utcDay(-5), utcDay(-3), "APPROVED", undefined, "Certificato INPS trasmesso");
  await leave("Bianchi", "ROL", utcDay(6), utcDay(6), "APPROVED", 4, "Visita medica");
  await leave("Ferri", "FERIE", utcDay(9), utcDay(11), "APPROVED");
  await leave("Romano", "EX_FESTIVITA", utcDay(3), utcDay(3), "APPROVED", 8);
  await leave("Costa", "FERIE", utcDay(2), utcDay(4), "APPROVED");
  await leave("Sala", "FERIE", utcDay(16), utcDay(20), "PENDING", undefined, "Viaggio programmato");
  await leave("Fontana", "ROL", utcDay(13), utcDay(13), "PENDING", 8);
  await leave("Galli", "FERIE", new Date(Date.UTC(YEAR, 11, 21)), new Date(Date.UTC(YEAR, 11, 31)), "PENDING");
  await leave("Leone", "ROL", utcDay(-12), utcDay(-12), "APPROVED", 3);
  await leave("Conti", "PERMESSO_NON_RETRIBUITO", utcDay(23), utcDay(24), "PENDING", undefined, "Trasloco");
  await leave("Greco", "ROL", utcDay(-30), utcDay(-30), "REJECTED", 8, "Picco di ticket");

  // Formazione: completamenti, attestati, idoneità e contratti
  const completeCourse = async (employeeId: string, lastName: string, code: string, completedAt: Date) => {
    const course = courses.get(code)!;
    const expiresAt = course.validityMonths ? new Date(completedAt) : null;
    expiresAt?.setMonth(expiresAt.getMonth() + course.validityMonths!);
    const title = COURSES.find((c) => c.code === code)!.title;
    const completion = await db.courseCompletion.create({
      data: {
        employeeId,
        courseId: course.id,
        completedAt,
        expiresAt,
        provider: PROVIDERS[code.length % PROVIDERS.length],
      },
    });
    await db.document.create({
      data: {
        employeeId,
        category: "ATTESTATO",
        title: `Attestato ${title}`,
        fileName: `attestato-${code.toLowerCase()}-${lastName.toLowerCase()}.pdf`,
        issuedAt: completedAt,
        expiresAt,
        completionId: completion.id,
      },
    });
  };

  for (const { id, seed } of employees) {
    const hiredAt = new Date(`${seed.hired}T09:00:00`);
    const monthsSinceHire = (Date.now() - hiredAt.getTime()) / (30.4 * DAY);
    if (seed.specMonthsAgo !== null) {
      const genAt = new Date(hiredAt.getTime() + 14 * DAY);
      await completeCourse(id, seed.lastName, "SIC-GEN", genAt);
      const specMonths = seed.specMonthsAgo ?? Math.min(Math.floor(monthsSinceHire) - 1, 30);
      await completeCourse(id, seed.lastName, "SIC-SPEC-B", monthsAgo(Math.max(specMonths, 1)));
    }
    for (const role of seed.safetyRoles ?? []) {
      const months = ROLE_TRAINING[seed.lastName]?.[role];
      if (months !== undefined) await completeCourse(id, seed.lastName, ROLE_COURSE[role], monthsAgo(months));
    }

    await db.document.createMany({
      data: [
        {
          employeeId: id,
          category: "CONTRATTO",
          title: `Contratto di lavoro ${(seed.contract ?? "INDETERMINATO").toLowerCase()}`,
          fileName: `contratto-${seed.lastName.toLowerCase()}.pdf`,
          issuedAt: hiredAt,
          expiresAt: seed.contractEndMonths ? daysFromNow(seed.contractEndMonths * 30) : null,
        },
        {
          employeeId: id,
          category: "PRIVACY",
          title: "Informativa privacy dipendenti (art. 13 GDPR)",
          fileName: `informativa-privacy-${seed.lastName.toLowerCase()}.pdf`,
          issuedAt: hiredAt,
        },
        {
          employeeId: id,
          category: "REGOLAMENTO",
          title: "Regolamento aziendale e policy strumenti IT",
          fileName: `regolamento-${seed.lastName.toLowerCase()}.pdf`,
          issuedAt: hiredAt,
        },
      ],
    });
    const medicalAt = seed.medicalMonthsAgo !== undefined ? monthsAgo(seed.medicalMonthsAgo) : new Date(hiredAt.getTime() + 7 * DAY);
    const medicalExpires = new Date(medicalAt);
    medicalExpires.setMonth(medicalExpires.getMonth() + 60);
    await db.document.create({
      data: {
        employeeId: id,
        category: "IDONEITA_MEDICA",
        title: "Giudizio di idoneità (videoterminalista)",
        fileName: `idoneita-${seed.lastName.toLowerCase()}.pdf`,
        issuedAt: medicalAt,
        expiresAt: medicalExpires,
      },
    });
  }

  // Sessioni: una passata da registrare, le altre in calendario
  const session = async (code: string, offsetDays: number, location: string, seats: number, enrolled: string[]) => {
    const date = daysFromNow(offsetDays);
    date.setHours(9, 0, 0, 0);
    const created = await db.courseSession.create({
      data: {
        courseId: courses.get(code)!.id,
        date,
        location,
        provider: PROVIDERS[(code.length + offsetDays) % PROVIDERS.length],
        seats,
      },
    });
    if (enrolled.length) {
      await db.courseEnrollment.createMany({
        data: enrolled.map((lastName) => ({ sessionId: created.id, employeeId: byLast(lastName).id })),
      });
    }
  };
  await session("SIC-SPEC-AGG", -3, "Sede di Milano, sala riunioni 2", 10, ["Conti"]);
  await session("SIC-GEN", 12, "Online (Teams)", 15, ["Barbieri"]);
  await session("SIC-SPEC-B", 13, "Online (Teams)", 15, ["Barbieri"]);
  await session("SIC-SPEC-AGG", 20, "Sede di Milano, sala riunioni 2", 10, ["Bianchi"]);
  await session("PS-AGG", 25, "Croce Verde, via Lomellina 12, Milano", 8, []);
  await session("AI-L1-AGG", 33, "Sede di Milano, cortile interno", 10, []);
  await session("PREP-AGG", 41, "Online (Teams)", 12, []);

  await db.auditLog.create({
    data: { actor: "system", action: "seed", payload: { employees: EMPLOYEES.length, devices: DEVICES.length } },
  });

  console.log(
    `Seed completato: ${EMPLOYEES.length} dipendenti in ${DEPARTMENTS.length} reparti, ${DEVICES.length} device, ${LICENSES.length} licenze, ${COURSES.length} corsi.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

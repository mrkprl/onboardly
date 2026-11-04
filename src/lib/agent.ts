import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { isoDateRome } from "@/lib/format";
import {
  activeAssignmentsWhere,
  buildOffboardingPlan,
  buildOnboardingPlan,
  deviceLabel,
  findAvailableDevice,
} from "@/lib/plans";

type MessageParam = Anthropic.Beta.BetaMessageParam;

const MODEL = "claude-sonnet-5-5";
const MAX_ITERATIONS = 10;

const client = new Anthropic();

function systemPrompt() {
  const today = isoDateRome();
  return `Sei l'assistente People Ops di Onboardly. Aiuti il team People & Culture a gestire ingressi (onboarding) e uscite (offboarding) dei dipendenti.

Oggi è ${today}. Rispondi sempre in italiano, in modo breve e concreto.

Come lavori:
- Usa i tool per leggere ruoli, dipendenti, dispositivi e licenze. Non inventare mai dati: se un'informazione non è nei tool, chiedila.
- Per un onboarding servono nome, cognome, team, ruolo (tra quelli esistenti) e data di inizio. Se manca qualcosa, chiedilo prima di proporre il piano. Se il sistema operativo non è indicato, usa quello di default del ruolo.
- Converti date relative ("lunedì prossimo") in YYYY-MM-DD partendo da oggi.
- Quando hai tutto, chiama propose_onboarding_plan o propose_offboarding_plan. Il piano NON viene eseguito: People & Culture lo approva dall'interfaccia.
- Per l'onboarding scrivi anche una mail di benvenuto calorosa ma sobria e un piano della prima settimana adatto al ruolo (5 giorni, 1-2 righe per giorno).
- Il piano di ingresso include anche documenti di assunzione, saldi ferie/ROL e iscrizione ai corsi di sicurezza obbligatori; quello di uscita il calcolo di ferie e ROL da liquidare. Li gestisce il sistema: citali solo se utile.
- Per l'offboarding la riconsegna dei dispositivi (PC e telefono) dipende da come lavora la persona: da remoto si spedisce con etichetta prepagata, in ufficio si riconsegna entro l'ultimo giorno. Usa return_method DEFAULT salvo indicazioni diverse di People & Culture. La mail di uscita la prepara il sistema.
- Dopo la proposta riassumi in poche righe gli step principali: device (o richiesta all'IT se manca), licenze (e quali richiedono posti aggiuntivi), costo o risparmio mensile, modalità di riconsegna. Il piano è solo proposto: non dire che device o licenze sono già assegnati o prenotati. Ricorda che serve l'approvazione.
- Non puoi revocare accessi, assegnare device o licenze direttamente: puoi solo proporre piani.`;
}

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "list_role_profiles",
    description:
      "Elenca i ruoli aziendali con sistema operativo di default, RAM minima, se serve un telefono aziendale e licenze previste.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "find_employee",
    description: "Cerca dipendenti per nome, cognome o email. Restituisce id, ruolo, team, stato, modalità di lavoro (ufficio/remoto), device (PC e telefoni) e licenze attive.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Nome, cognome o email (anche parziale)" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "check_device_availability",
    description:
      "Verifica se esiste un device disponibile. Per un PC indica sistema operativo e RAM minima; per un telefono usa type PHONE (os e RAM vengono ignorati).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["LAPTOP", "PHONE"] },
        os: { type: "string", enum: ["MACOS", "WINDOWS"] },
        min_ram_gb: { type: "integer" },
      },
      required: ["type", "os", "min_ram_gb"],
      additionalProperties: false,
    },
  },
  {
    name: "check_license_seats",
    description: "Mostra per ogni licenza i posti usati, totali, liberi e il costo mensile per posto.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "propose_onboarding_plan",
    description:
      "Crea una proposta di onboarding (non eseguita). Il sistema sceglie il device e verifica le licenze del ruolo; se mancano risorse prepara richieste all'IT.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        team: { type: "string" },
        role_name: { type: "string", description: "Nome esatto del ruolo da list_role_profiles" },
        start_date: { type: "string", description: "Data di inizio, formato YYYY-MM-DD" },
        os: { type: "string", enum: ["MACOS", "WINDOWS"] },
        welcome_email: { type: "string", description: "Mail di benvenuto per il nuovo assunto" },
        first_week_plan: { type: "string", description: "Piano della prima settimana, un giorno per riga" },
      },
      required: ["first_name", "last_name", "team", "role_name", "start_date", "os", "welcome_email", "first_week_plan"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_offboarding_plan",
    description:
      "Crea una proposta di offboarding (non eseguita): sospensione account, backup dati, licenze da rilasciare, recupero di PC e telefono (via corriere con etichetta o in ufficio) e mail di uscita.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        employee_id: { type: "string", description: "id da find_employee" },
        end_date: { type: "string", description: "Ultimo giorno di lavoro, formato YYYY-MM-DD" },
        return_method: {
          type: "string",
          enum: ["DEFAULT", "SHIPPING", "OFFICE"],
          description: "DEFAULT segue la modalità di lavoro (remoto = spedizione, ufficio = riconsegna in sede)",
        },
      },
      required: ["employee_id", "end_date", "return_method"],
      additionalProperties: false,
    },
  },
];

const OsSchema = z.enum(["MACOS", "WINDOWS"]);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato data atteso YYYY-MM-DD");

const toolInputs = {
  list_role_profiles: z.object({}),
  find_employee: z.object({ query: z.string().min(2) }),
  check_device_availability: z.object({
    type: z.enum(["LAPTOP", "PHONE"]),
    os: OsSchema,
    min_ram_gb: z.number().int().nonnegative(),
  }),
  check_license_seats: z.object({}),
  propose_onboarding_plan: z.object({
    first_name: z.string().min(1).max(60),
    last_name: z.string().min(1).max(60),
    team: z.string().min(1).max(60),
    role_name: z.string().min(1).max(80),
    start_date: DateSchema,
    os: OsSchema,
    welcome_email: z.string().min(1).max(4000),
    first_week_plan: z.string().min(1).max(4000),
  }),
  propose_offboarding_plan: z.object({
    employee_id: z.string().min(1),
    end_date: DateSchema,
    return_method: z.enum(["DEFAULT", "SHIPPING", "OFFICE"]),
  }),
};

type ToolName = keyof typeof toolInputs;

async function runTool(name: string, rawInput: unknown, proposedPlanIds: string[]) {
  if (!(name in toolInputs)) throw new Error(`Tool sconosciuto: ${name}`);
  const toolName = name as ToolName;
  const input = toolInputs[toolName].parse(rawInput);

  switch (toolName) {
    case "list_role_profiles": {
      const roles = await db.roleProfile.findMany({ include: { licenses: { include: { license: true } } } });
      return roles.map((r) => ({
        name: r.name,
        defaultOs: r.defaultOs,
        minRamGb: r.minRamGb,
        needsPhone: r.needsPhone,
        licenses: r.licenses.map((l) => l.license.product),
      }));
    }
    case "find_employee": {
      const { query } = input as z.infer<(typeof toolInputs)["find_employee"]>;
      const terms = query.trim().split(/\s+/);
      const employees = await db.employee.findMany({
        where: {
          AND: terms.map((t) => ({
            OR: [
              { firstName: { contains: t, mode: "insensitive" as const } },
              { lastName: { contains: t, mode: "insensitive" as const } },
              { email: { contains: t, mode: "insensitive" as const } },
            ],
          })),
        },
        include: {
          role: true,
          devices: true,
          licenses: { where: activeAssignmentsWhere(), include: { license: true } },
        },
        take: 5,
      });
      return employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        email: e.email,
        role: e.role.name,
        team: e.team,
        status: e.status,
        workMode: e.workMode,
        hasShippingAddress: Boolean(e.address),
        devices: e.devices.map((d) => `${deviceLabel(d)} · ${d.type} · ${d.status}`),
        licenses: e.licenses.map((a) => a.license.product),
      }));
    }
    case "check_device_availability": {
      const { type, os, min_ram_gb } = input as z.infer<(typeof toolInputs)["check_device_availability"]>;
      const device = await findAvailableDevice(
        db,
        type === "PHONE" ? { type } : { type, os, minRamGb: min_ram_gb },
      );
      return device
        ? { available: true, device: deviceLabel(device) }
        : { available: false, note: "Nessun device compatibile: il piano includerà una richiesta all'IT." };
    }
    case "check_license_seats": {
      const licenses = await db.license.findMany({
        include: { _count: { select: { assignments: { where: activeAssignmentsWhere() } } } },
        orderBy: { product: "asc" },
      });
      return licenses.map((l) => ({
        product: l.product,
        used: l._count.assignments,
        total: l.totalSeats,
        free: l.totalSeats - l._count.assignments,
        monthlyCostPerSeat: Number(l.monthlyCostPerSeat),
      }));
    }
    case "propose_onboarding_plan": {
      const i = input as z.infer<(typeof toolInputs)["propose_onboarding_plan"]>;
      const { planId, steps, monthlyCost } = await buildOnboardingPlan({
        firstName: i.first_name,
        lastName: i.last_name,
        team: i.team,
        roleName: i.role_name,
        startDate: i.start_date,
        os: i.os,
        welcomeEmail: i.welcome_email,
        firstWeekPlan: i.first_week_plan,
      });
      proposedPlanIds.push(planId);
      return { planId, status: "PROPOSED, in attesa di approvazione", steps, monthlyLicenseCost: monthlyCost };
    }
    case "propose_offboarding_plan": {
      const i = input as z.infer<(typeof toolInputs)["propose_offboarding_plan"]>;
      const { planId, employee, returnMethod, steps, monthlyCost } = await buildOffboardingPlan({
        employeeId: i.employee_id,
        endDate: i.end_date,
        returnMethod: i.return_method === "DEFAULT" ? undefined : i.return_method,
      });
      proposedPlanIds.push(planId);
      return { planId, employee, returnMethod, status: "PROPOSED, in attesa di approvazione", steps, monthlySaving: monthlyCost };
    }
  }
}

export async function runAgent(history: MessageParam[]) {
  const messages = [...history];
  const proposedPlanIds: string[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "refusal") {
      return { messages, proposedPlanIds, reply: "Non posso aiutarti con questa richiesta." };
    }
    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") {
      const reply = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { messages, proposedPlanIds, reply };
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    const results = await Promise.all(
      toolUses.map(async (tool): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        try {
          const output = await runTool(tool.name, tool.input, proposedPlanIds);
          return { type: "tool_result", tool_use_id: tool.id, content: JSON.stringify(output) };
        } catch (error) {
          const message = error instanceof z.ZodError ? z.prettifyError(error) : (error as Error).message;
          return { type: "tool_result", tool_use_id: tool.id, content: message, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }

  return { messages, proposedPlanIds, reply: "Mi sono fermato: troppi passaggi. Riformula la richiesta." };
}

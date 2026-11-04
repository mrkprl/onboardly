"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import {
  addLicenseSeat,
  completeItRequest,
  createDevice,
  renewLicense,
  setDeviceStatus,
  trimLicenseSeats,
} from "@/lib/it";
import { rejectPlan } from "@/lib/plans";
import { confirmShipment } from "@/lib/shipping";

type ActionResult = { ok: true; outcomes?: string[] } | { ok: false; error: string };

async function run(fn: () => Promise<string[] | void>): Promise<ActionResult> {
  try {
    const outcomes = (await fn()) ?? undefined;
    revalidatePath("/people");
    revalidatePath("/it");
    return { ok: true, outcomes };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

const Id = z.string().min(1, "Identificativo mancante").max(64, "Identificativo non valido");

function withId(id: string, fn: (id: string) => Promise<string[] | void>): Promise<ActionResult> {
  const parsed = Id.safeParse(id);
  if (!parsed.success) return Promise.resolve({ ok: false, error: parsed.error.issues[0].message });
  return run(() => fn(parsed.data));
}

const ShipmentConfirmSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{32}$/, "Link non valido"),
  shippedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
    .refine((v) => {
      const d = new Date(`${v}T00:00:00.000Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, "Data non valida"),
  note: z.string().trim().max(300, "Nota troppo lunga").optional(),
});

export async function confirmShipmentAction(input: { token: string; shippedOn: string; note?: string }) {
  const parsed = ShipmentConfirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  try {
    await confirmShipment(parsed.data.token, {
      shippedOn: new Date(`${parsed.data.shippedOn}T12:00:00+01:00`),
      note: parsed.data.note || null,
    });
    revalidatePath("/people");
    revalidatePath("/it");
    revalidatePath(`/spedizione/${parsed.data.token}`);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export async function refreshPlansAction() {
  revalidatePath("/people");
  revalidatePath("/it");
}

export async function rejectPlanAction(planId: string) {
  return withId(planId, (id) => rejectPlan(id));
}

export async function completeItRequestAction(requestId: string) {
  return withId(requestId, (id) => completeItRequest(id));
}

export async function setDeviceStatusAction(deviceId: string, status: "AVAILABLE" | "IN_REPAIR" | "RETIRED") {
  const parsed = z.enum(["AVAILABLE", "IN_REPAIR", "RETIRED"], { message: "Stato non valido" }).safeParse(status);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  return withId(deviceId, (id) => setDeviceStatus(id, parsed.data));
}

const NewDeviceSchema = z.object({
  model: z.string().trim().min(2, "Modello obbligatorio").max(80, "Modello troppo lungo"),
  type: z.enum(["LAPTOP", "PHONE"], { message: "Tipo non valido" }),
  os: z.enum(["MACOS", "WINDOWS", "IOS", "ANDROID"], { message: "Sistema operativo non valido" }),
  ramGb: z.coerce
    .number({ message: "RAM non valida" })
    .int("RAM non valida")
    .min(4, "RAM minima 4GB")
    .max(128, "RAM massima 128GB"),
  serial: z.string().trim().min(4, "Seriale obbligatorio").max(40, "Seriale troppo lungo").toUpperCase(),
});

export async function createDeviceAction(input: {
  model: string;
  type: string;
  os: string;
  ramGb: string;
  serial: string;
}) {
  const parsed = NewDeviceSchema.refine((d) => (d.type === "PHONE") === (d.os === "IOS" || d.os === "ANDROID"), {
    message: "Sistema non coerente con il tipo: iOS/Android per i telefoni, macOS/Windows per i PC",
  }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  return run(() => createDevice(parsed.data));
}

export async function trimLicenseSeatsAction(licenseId: string) {
  return withId(licenseId, (id) => trimLicenseSeats(id));
}

export async function addLicenseSeatAction(licenseId: string) {
  return withId(licenseId, (id) => addLicenseSeat(id));
}

export async function renewLicenseAction(licenseId: string) {
  return withId(licenseId, (id) => renewLicense(id));
}

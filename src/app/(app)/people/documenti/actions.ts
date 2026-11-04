"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import { db } from "@/lib/db";
import { isoDateRome } from "@/lib/format";
import { addDocument, deleteDocument } from "@/lib/documents";
import { ISO_DAY, romeMorning } from "@/app/(app)/people/formazione/rome-date";

type ActionResult = { ok: true; outcomes?: string[] } | { ok: false; error: string };

const CATEGORIES = ["CONTRATTO", "ATTESTATO", "IDONEITA_MEDICA", "PRIVACY", "REGOLAMENTO", "ALTRO"] as const;

function revalidateDocuments(employeeId: string) {
  revalidatePath("/people/documenti");
  revalidatePath("/people/anagrafica");
  revalidatePath(`/people/anagrafica/${employeeId}`);
}

const NewDocumentSchema = z
  .object({
    employeeId: z.string().min(1, "Scegli il dipendente"),
    category: z.enum(CATEGORIES, "Categoria non valida"),
    title: z.string().trim().min(3, "Titolo troppo corto").max(120, "Titolo troppo lungo"),
    issuedAt: z
      .string()
      .regex(ISO_DAY, "Data di emissione non valida")
      .refine((d) => d <= isoDateRome(), "La data di emissione non può essere futura"),
    expiresAt: z.union([z.literal(""), z.string().regex(ISO_DAY, "Scadenza non valida")]),
  })
  .refine((d) => !d.expiresAt || d.expiresAt > d.issuedAt, {
    message: "La scadenza deve essere successiva all'emissione",
    path: ["expiresAt"],
  });

export async function addDocumentAction(input: {
  employeeId: string;
  category: string;
  title: string;
  issuedAt: string;
  expiresAt: string;
}): Promise<ActionResult> {
  const parsed = NewDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const employee = await db.employee.findUnique({ where: { id: parsed.data.employeeId } });
    if (!employee) return { ok: false, error: "Dipendente non trovato" };
    await addDocument({
      employeeId: parsed.data.employeeId,
      category: parsed.data.category,
      title: parsed.data.title,
      issuedAt: romeMorning(parsed.data.issuedAt),
      expiresAt: parsed.data.expiresAt ? romeMorning(parsed.data.expiresAt) : null,
    });
    revalidateDocuments(parsed.data.employeeId);
    return { ok: true, outcomes: [`Documento aggiunto a ${employee.firstName} ${employee.lastName}`] };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteDocumentAction(documentId: string): Promise<ActionResult> {
  const parsed = z.string().min(1, "Documento non valido").safeParse(documentId);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const document = await db.document.findUnique({ where: { id: parsed.data } });
    if (!document) return { ok: false, error: "Documento non trovato" };
    await deleteDocument(parsed.data);
    revalidateDocuments(document.employeeId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

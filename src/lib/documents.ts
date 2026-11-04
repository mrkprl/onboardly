import { db } from "@/lib/db";
import type { DocumentCategory, Prisma } from "@/generated/prisma/client";

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  CONTRATTO: "Contratto",
  ATTESTATO: "Attestato",
  IDONEITA_MEDICA: "Idoneità medica",
  PRIVACY: "Privacy",
  REGOLAMENTO: "Regolamento",
  ALTRO: "Altro",
};

export type DocumentStatus = "VALID" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY";

const DAY = 24 * 60 * 60 * 1000;

export function documentStatus(expiresAt: Date | null, now = new Date()): DocumentStatus {
  if (!expiresAt) return "NO_EXPIRY";
  if (expiresAt < now) return "EXPIRED";
  if (expiresAt.getTime() - now.getTime() <= 60 * DAY) return "EXPIRING";
  return "VALID";
}

type Tx = Prisma.TransactionClient;

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// I file sono simulati: si registrano i metadati e il documento viene generato a video
export async function addDocument(
  input: {
    employeeId: string;
    category: DocumentCategory;
    title: string;
    issuedAt: Date;
    expiresAt?: Date | null;
  },
  actor = "people",
  client: Tx | typeof db = db,
) {
  const employee = await client.employee.findUniqueOrThrow({ where: { id: input.employeeId } });
  const document = await client.document.create({
    data: {
      employeeId: input.employeeId,
      category: input.category,
      title: input.title,
      fileName: `${slug(input.title)}-${slug(employee.lastName)}.pdf`,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt ?? null,
    },
  });
  await client.auditLog.create({
    data: {
      actor,
      action: "document.added",
      payload: {
        documentId: document.id,
        outcomes: [`${DOCUMENT_CATEGORY_LABEL[input.category]} "${input.title}" per ${employee.firstName} ${employee.lastName}`],
      },
    },
  });
  return document;
}

export async function deleteDocument(documentId: string, actor = "people") {
  const document = await db.document.findUniqueOrThrow({ where: { id: documentId }, include: { employee: true } });
  if (document.completionId) throw new Error("Gli attestati dei corsi si gestiscono dalla formazione");
  await db.document.delete({ where: { id: documentId } });
  await db.auditLog.create({
    data: {
      actor,
      action: "document.deleted",
      payload: {
        documentId,
        outcomes: [`Eliminato "${document.title}" di ${document.employee.firstName} ${document.employee.lastName}`],
      },
    },
  });
}

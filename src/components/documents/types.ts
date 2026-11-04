import type { DocumentCategory } from "@/generated/prisma/enums";
import type { DocumentStatus } from "@/lib/documents";

export type { DocumentCategory, DocumentStatus };

export type CategoryLabels = Record<DocumentCategory, string>;

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; color: "success" | "warning" | "danger" | "default" }> = {
  VALID: { label: "Valido", color: "success" },
  EXPIRING: { label: "In scadenza", color: "warning" },
  EXPIRED: { label: "Scaduto", color: "danger" },
  NO_EXPIRY: { label: "Senza scadenza", color: "default" },
};

export type DocumentView = {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string;
  category: DocumentCategory;
  title: string;
  fileName: string;
  issuedAt: string;
  expiresAt: string | null;
  daysLeft: number | null;
  status: DocumentStatus;
  isCertificate: boolean;
};

export type EmployeeOption = { id: string; name: string; departmentName: string };

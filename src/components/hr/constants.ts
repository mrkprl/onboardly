import type { ContractType, EmployeeStatus, LeaveStatus, LeaveType } from "@/generated/prisma/client";
import type { DocumentStatus } from "@/lib/documents";
import type { TrainingStatus } from "@/lib/training";

// Costanti leggibili sia dai server component sia dai client component (nessuna direttiva "use client")

export type ChipColor = "accent" | "success" | "warning" | "danger" | "default";

export const EMPLOYEE_STATUS_HR: Record<EmployeeStatus, { label: string; color: ChipColor }> = {
  ONBOARDING: { label: "In ingresso", color: "accent" },
  ACTIVE: { label: "Attivo", color: "success" },
  OFFBOARDING: { label: "In uscita", color: "warning" },
  LEFT: { label: "Uscito", color: "default" },
};

export const EMPLOYEE_STATUSES = ["ONBOARDING", "ACTIVE", "OFFBOARDING", "LEFT"] as const;

export const CONTRACT_LABEL: Record<ContractType, string> = {
  INDETERMINATO: "Indeterminato",
  DETERMINATO: "Determinato",
  APPRENDISTATO: "Apprendistato",
};

export const WORK_MODE_LABEL = { OFFICE: "In ufficio", REMOTE: "Da remoto" } as const;

export const LEAVE_STATUS: Record<LeaveStatus, { label: string; color: ChipColor }> = {
  PENDING: { label: "In attesa", color: "warning" },
  APPROVED: { label: "Approvata", color: "success" },
  REJECTED: { label: "Rifiutata", color: "default" },
};

export const LEAVE_TYPES = ["FERIE", "ROL", "EX_FESTIVITA", "MALATTIA", "PERMESSO_NON_RETRIBUITO"] as const;

// Colore e sigla per il calendario presenze: la sigla rende leggibile la cella anche senza colore
export const LEAVE_CELL: Record<LeaveType, { short: string; className: string }> = {
  FERIE: { short: "F", className: "bg-accent-soft text-accent-soft-foreground" },
  ROL: { short: "R", className: "bg-success-soft text-success-soft-foreground" },
  EX_FESTIVITA: { short: "EF", className: "bg-warning-soft text-warning-soft-foreground" },
  MALATTIA: { short: "M", className: "bg-danger-soft text-danger-soft-foreground" },
  PERMESSO_NON_RETRIBUITO: { short: "P", className: "bg-default text-default-foreground" },
};

export const TRAINING_STATUS_COLOR: Record<TrainingStatus, ChipColor> = {
  VALID: "success",
  EXPIRING: "warning",
  EXPIRED: "danger",
  MISSING: "default",
};

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; color: ChipColor }> = {
  VALID: { label: "Valido", color: "success" },
  EXPIRING: { label: "In scadenza", color: "warning" },
  EXPIRED: { label: "Scaduto", color: "danger" },
  NO_EXPIRY: { label: "Senza scadenza", color: "default" },
};

export const CONTRACT_EXPIRING_DAYS = 60;
export const HIGH_FERIE_DAYS = 15;

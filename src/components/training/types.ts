import type { TrainingStatus } from "@/lib/training";

export type { TrainingStatus };

export type StatusLabels = Record<TrainingStatus, string>;

export const STATUS_COLOR: Record<TrainingStatus, "success" | "warning" | "danger" | "default"> = {
  VALID: "success",
  EXPIRING: "warning",
  EXPIRED: "danger",
  MISSING: "default",
};

export type CourseColumn = { id: string; title: string; label: string };

export type MatrixCell = {
  status: TrainingStatus;
  expiresAt: string | null;
  enrolledDate: string | null;
  awaitingRegistration: boolean;
};

export type MatrixRow = {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string;
  cells: Record<string, MatrixCell>;
};

export type PlanItem = {
  key: string;
  employeeId: string;
  name: string;
  departmentName: string;
  courseTitle: string;
  status: TrainingStatus;
  expiresAt: string | null;
  nextCourse: { id: string; title: string; isRenewal: boolean };
  nextSession: { id: string; date: string; time: string; location: string; seatsLeft: number } | null;
  fullSessions: number;
};

export type SessionPerson = { employeeId: string; name: string; departmentName: string };

export type SessionView = {
  id: string;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  date: string;
  time: string;
  location: string;
  provider: string;
  seats: number;
  past: boolean;
  enrolled: SessionPerson[];
  candidates: (SessionPerson & { status: TrainingStatus })[];
};

export type CourseOption = { id: string; title: string; code: string; hours: number; isRenewal: boolean };

export type ActionResult = { ok: true; outcomes?: string[] } | { ok: false; error: string };

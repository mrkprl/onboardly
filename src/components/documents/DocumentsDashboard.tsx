import { connection } from "next/server";
import { db } from "@/lib/db";
import { daysUntil, isoDateRome } from "@/lib/format";
import { DOCUMENT_CATEGORY_LABEL, documentStatus } from "@/lib/documents";
import DocumentsArchive from "@/components/documents/DocumentsArchive";
import type { DocumentView, EmployeeOption } from "@/components/documents/types";

const NO_DEPARTMENT = "Senza reparto";

export default async function DocumentsDashboard() {
  await connection();
  const [documents, employees] = await Promise.all([
    db.document.findMany({
      include: { employee: { include: { department: true } } },
      orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
    }),
    db.employee.findMany({
      where: { status: { not: "LEFT" } },
      include: { department: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const now = new Date();
  const views: DocumentView[] = documents.map((d) => ({
    id: d.id,
    employeeId: d.employeeId,
    employeeName: `${d.employee.firstName} ${d.employee.lastName}`,
    departmentId: d.employee.departmentId,
    departmentName: d.employee.department?.name ?? NO_DEPARTMENT,
    category: d.category,
    title: d.title,
    fileName: d.fileName,
    issuedAt: d.issuedAt.toISOString(),
    expiresAt: d.expiresAt?.toISOString() ?? null,
    daysLeft: d.expiresAt ? daysUntil(d.expiresAt) : null,
    status: documentStatus(d.expiresAt, now),
    isCertificate: Boolean(d.completionId),
  }));

  const employeeOptions: EmployeeOption[] = employees.map((e) => ({
    id: e.id,
    name: `${e.lastName} ${e.firstName}`,
    departmentName: e.department?.name ?? NO_DEPARTMENT,
  }));

  return (
    <DocumentsArchive
      documents={views}
      employees={employeeOptions}
      categoryLabels={DOCUMENT_CATEGORY_LABEL}
      today={isoDateRome()}
    />
  );
}

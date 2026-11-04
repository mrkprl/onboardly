import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Spinner } from "@heroui/react";
import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { DOCUMENT_CATEGORY_LABEL, documentStatus } from "@/lib/documents";
import PrintDocumentButton from "@/components/documents/PrintDocumentButton";
import { CertificateSheet, DocumentCover } from "@/components/documents/DocumentSheet";

// La navigazione della sezione People sta nel layout condiviso: in stampa va nascosta
async function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const document = await db.document.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true, role: true } },
      completion: { include: { course: { include: { renewsCourse: true } } } },
    },
  });
  if (!document) notFound();

  const sheet = {
    id: document.id,
    category: document.category,
    categoryLabel: DOCUMENT_CATEGORY_LABEL[document.category],
    title: document.title,
    fileName: document.fileName,
    issuedAt: document.issuedAt,
    expiresAt: document.expiresAt,
    status: documentStatus(document.expiresAt),
    employee: {
      firstName: document.employee.firstName,
      lastName: document.employee.lastName,
      departmentName: document.employee.department?.name ?? "Senza reparto",
      roleName: document.employee.role.name,
    },
  };
  const completion = document.category === "ATTESTATO" ? document.completion : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-wrap gap-x-4 text-sm">
          <Link
            href={`/people/anagrafica/${document.employeeId}`}
            className="inline-flex min-h-10 items-center gap-1.5 text-muted hover:text-foreground"
          >
            <ArrowLeftIcon size={16} />
            Profilo di {document.employee.firstName} {document.employee.lastName}
          </Link>
          <Link href="/people/documenti" className="inline-flex min-h-10 items-center text-muted hover:text-foreground">
            Archivio documenti
          </Link>
        </div>
        <PrintDocumentButton />
      </div>
      {completion ? (
        <CertificateSheet
          document={sheet}
          certificate={{
            completedAt: completion.completedAt,
            expiresAt: completion.expiresAt,
            provider: completion.provider,
            course: {
              title: completion.course.title,
              code: completion.course.code,
              hours: completion.course.hours,
              validityMonths: completion.course.validityMonths,
              renewsTitle: completion.course.renewsCourse?.title ?? null,
            },
          }}
        />
      ) : (
        <DocumentCover document={sheet} />
      )}
    </div>
  );
}

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      }
    >
      <DocumentDetail params={params} />
    </Suspense>
  );
}

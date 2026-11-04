import { formatDate } from "@/lib/format";
import { DOCUMENT_STATUS, type DocumentCategory, type DocumentStatus } from "@/components/documents/types";

type SheetDocument = {
  id: string;
  category: DocumentCategory;
  categoryLabel: string;
  title: string;
  fileName: string;
  issuedAt: Date;
  expiresAt: Date | null;
  status: DocumentStatus;
  employee: { firstName: string; lastName: string; departmentName: string; roleName: string };
};

type SheetCertificate = {
  completedAt: Date;
  expiresAt: Date | null;
  provider: string;
  course: {
    title: string;
    code: string;
    hours: number;
    validityMonths: number | null;
    renewsTitle: string | null;
  };
};

const paper =
  "flex flex-col gap-8 rounded-2xl border border-border bg-surface p-6 text-foreground sm:p-10 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black";
const muted = "text-muted print:text-black";

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border py-2.5 sm:flex-row sm:gap-4 print:border-black/30">
      <dt className={`w-40 shrink-0 text-xs ${muted}`}>{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function CertificateSheet({ document, certificate }: { document: SheetDocument; certificate: SheetCertificate }) {
  const { course } = certificate;
  const fullName = `${document.employee.firstName} ${document.employee.lastName}`;
  return (
    <article className={paper} aria-label={`Attestato di ${fullName}`}>
      <header className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Attestato di frequenza</h2>
        <p className={`text-sm ${muted}`}>Formazione in materia di salute e sicurezza sui luoghi di lavoro</p>
      </header>

      <section className="flex flex-col items-center gap-3 text-center">
        <p className={`text-sm ${muted}`}>Si attesta che</p>
        <p className="text-3xl font-semibold tracking-tight">{fullName}</p>
        <p className={`text-sm ${muted}`}>
          {document.employee.roleName}, {document.employee.departmentName}
        </p>
        <p className={`mt-2 text-sm ${muted}`}>ha frequentato con esito positivo il corso</p>
        <p className="text-xl font-medium">{course.title}</p>
        {course.renewsTitle && <p className={`text-sm ${muted}`}>Aggiornamento di: {course.renewsTitle}</p>}
      </section>

      <dl className="mx-auto w-full max-w-lg border-b border-border print:border-black/30">
        <Meta label="Durata">
          <span className="font-mono tabular-nums">{course.hours} ore</span>
        </Meta>
        <Meta label="Data di svolgimento">
          <span className="font-mono tabular-nums">{formatDate(certificate.completedAt)}</span>
        </Meta>
        <Meta label="Ente formatore">{certificate.provider}</Meta>
        <Meta label="Validità">
          {course.validityMonths && certificate.expiresAt ? (
            <>
              {course.validityMonths} mesi, fino al{" "}
              <span className="font-mono tabular-nums">{formatDate(certificate.expiresAt)}</span>
            </>
          ) : (
            "Senza scadenza"
          )}
        </Meta>
        <Meta label="Codice corso">
          <span className="font-mono">{course.code}</span>
        </Meta>
      </dl>

      <p className={`mx-auto max-w-lg text-center text-xs leading-relaxed ${muted}`}>
        Attestato rilasciato ai sensi dell&apos;art. 37 del D.Lgs. 81/2008 e dei relativi accordi Stato-Regioni sulla
        formazione dei lavoratori. Durate e periodicità di aggiornamento indicative, da verificare con l&apos;RSPP.
      </p>

      <footer className="mt-4 grid gap-8 sm:grid-cols-2 sm:items-end">
        <div className="text-sm">
          <p className={`text-xs ${muted}`}>Data di rilascio</p>
          <p className="font-mono tabular-nums">{formatDate(document.issuedAt)}</p>
          <p className={`mt-2 font-mono text-xs ${muted}`}>Rif. {document.id}</p>
        </div>
        <div className="flex flex-col items-center gap-1 sm:items-end">
          <span className="h-10 w-56 border-b border-foreground print:border-black" aria-hidden />
          <p className="w-56 text-center text-sm">Il responsabile del corso</p>
        </div>
      </footer>
    </article>
  );
}

export function DocumentCover({ document }: { document: SheetDocument }) {
  const fullName = `${document.employee.firstName} ${document.employee.lastName}`;
  const status = DOCUMENT_STATUS[document.status];
  const tone =
    document.status === "EXPIRED" ? "text-danger" : document.status === "EXPIRING" ? "text-warning" : "";
  return (
    <article className={paper} aria-label={document.title}>
      <header className="flex flex-col gap-1">
        <p className={`text-sm ${muted}`}>{document.categoryLabel}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{document.title}</h2>
      </header>

      <dl className="border-b border-border print:border-black/30">
        <Meta label="Dipendente">{fullName}</Meta>
        <Meta label="Reparto e ruolo">
          {document.employee.departmentName}, {document.employee.roleName}
        </Meta>
        <Meta label="Categoria">{document.categoryLabel}</Meta>
        <Meta label="Emesso il">
          <span className="font-mono tabular-nums">{formatDate(document.issuedAt)}</span>
        </Meta>
        <Meta label="Scadenza">
          {document.expiresAt ? (
            <span className={`print:text-black ${tone}`}>
              <span className="font-mono tabular-nums">{formatDate(document.expiresAt)}</span>, {status.label.toLowerCase()}
            </span>
          ) : (
            "Senza scadenza"
          )}
        </Meta>
        <Meta label="Nome file">
          <span className="font-mono text-xs break-all">{document.fileName}</span>
        </Meta>
        <Meta label="Riferimento">
          <span className="font-mono text-xs">{document.id}</span>
        </Meta>
      </dl>

      <p className={`rounded-xl border border-dashed border-border p-4 text-sm ${muted} print:border-black/40`}>
        Anteprima generata: il file originale è simulato nella demo.
      </p>
    </article>
  );
}

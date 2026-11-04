"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Chip, Input } from "@heroui/react";
import { formatDate } from "@/lib/format";
import { EmptyState, FilterPills } from "@/components/it/shared";
import DeleteDocumentButton from "@/components/documents/DeleteDocumentButton";
import NewDocumentForm from "@/components/documents/NewDocumentForm";
import {
  DOCUMENT_STATUS,
  type CategoryLabels,
  type DocumentCategory,
  type DocumentView,
  type EmployeeOption,
} from "@/components/documents/types";

type StatusFilter = "all" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY";

const PAGE_SIZE = 25;

function expiryText(d: DocumentView) {
  if (d.daysLeft === null) return null;
  if (d.daysLeft < 0) return d.daysLeft === -1 ? "scaduto ieri" : `scaduto da ${-d.daysLeft} giorni`;
  if (d.daysLeft === 0) return "scade oggi";
  return d.daysLeft === 1 ? "scade domani" : `tra ${d.daysLeft} giorni`;
}

export default function DocumentsArchive({
  documents,
  employees,
  categoryLabels,
  today,
}: {
  documents: DocumentView[];
  employees: EmployeeOption[];
  categoryLabels: CategoryLabels;
  today: string;
}) {
  const [category, setCategory] = useState<"all" | DocumentCategory>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [department, setDepartment] = useState("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const filterKey = [category, status, department, query].join("|");
  const [shown, setShown] = useState({ key: filterKey, count: PAGE_SIZE });
  const limit = shown.key === filterKey ? shown.count : PAGE_SIZE;

  const attention = documents
    .filter((d) => d.status === "EXPIRED" || d.status === "EXPIRING")
    .sort((a, b) => (a.expiresAt ?? "").localeCompare(b.expiresAt ?? ""));

  const departments = [...new Map(documents.map((d) => [d.departmentId ?? "none", d.departmentName])).entries()].sort(
    (a, b) => a[1].localeCompare(b[1], "it"),
  );
  const categories = (Object.keys(categoryLabels) as DocumentCategory[]).filter((c) =>
    documents.some((d) => d.category === c),
  );

  const q = query.trim().toLowerCase();
  const base = documents.filter(
    (d) =>
      (department === "all" || (d.departmentId ?? "none") === department) &&
      (!q || [d.employeeName, d.title, d.fileName].some((v) => v.toLowerCase().includes(q))),
  );
  const visible = base.filter(
    (d) => (category === "all" || d.category === category) && (status === "all" || d.status === status),
  );
  const inCategory = base.filter((d) => category === "all" || d.category === category);
  const page = visible.slice(0, limit);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="attention-title" className="flex flex-col gap-3">
        <div>
          <h2 id="attention-title" className="text-lg font-semibold tracking-tight">
            Scaduti e in scadenza
            {attention.length > 0 && (
              <span className="ml-2 font-mono text-base text-muted tabular-nums">{attention.length}</span>
            )}
          </h2>
          <p className="text-sm text-muted">Documenti scaduti o che scadono entro 60 giorni, dal più urgente.</p>
        </div>
        {attention.length === 0 ? (
          <EmptyState>Nessun documento scaduto o in scadenza nei prossimi 60 giorni.</EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {attention.map((d) => (
              <li
                key={d.id}
                className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] sm:items-center sm:gap-4"
              >
                <Link href={`/people/anagrafica/${d.employeeId}`} className="font-medium hover:underline">
                  {d.employeeName}
                </Link>
                <Link href={`/people/documenti/${d.id}`} className="min-w-0 truncate hover:underline">
                  <span className="text-muted">{categoryLabels[d.category]}: </span>
                  {d.title}
                </Link>
                <span className="flex items-center gap-2 sm:justify-end">
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {d.expiresAt && formatDate(d.expiresAt)}, {expiryText(d)}
                  </span>
                  <Chip size="sm" variant="soft" color={DOCUMENT_STATUS[d.status].color}>
                    {DOCUMENT_STATUS[d.status].label}
                  </Chip>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="archive-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="archive-title" className="text-lg font-semibold tracking-tight">
              Archivio
            </h2>
            <p className="text-sm text-muted">
              Gli attestati dei corsi vengono creati dalla formazione quando si registra una sessione.
            </p>
          </div>
          <Button variant={showForm ? "ghost" : "primary"} onPress={() => setShowForm((v) => !v)}>
            {showForm ? "Annulla" : "Aggiungi documento"}
          </Button>
        </div>

        {showForm && (
          <NewDocumentForm
            employees={employees}
            categoryLabels={categoryLabels}
            today={today}
            onDone={() => setShowForm(false)}
          />
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <FilterPills<"all" | DocumentCategory>
              label="Filtra per categoria"
              scrollOnMobile
              value={category}
              onChange={setCategory}
              options={[
                { value: "all", label: "Tutte le categorie", count: base.length },
                ...categories.map((c) => ({
                  value: c,
                  label: categoryLabels[c],
                  count: base.filter((d) => d.category === c).length,
                })),
              ]}
            />
            <Input
              aria-label="Cerca per persona, titolo o file"
              placeholder="Cerca persona, titolo, file"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full lg:w-64"
            />
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <FilterPills<StatusFilter>
              label="Filtra per scadenza"
              scrollOnMobile
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "Qualsiasi scadenza", count: inCategory.length },
                ...(["EXPIRING", "EXPIRED", "NO_EXPIRY"] as const).map((s) => ({
                  value: s,
                  label: DOCUMENT_STATUS[s].label,
                  count: inCategory.filter((d) => d.status === s).length,
                })),
              ]}
            />
            <FilterPills
              label="Filtra per reparto"
              scrollOnMobile
              value={department}
              onChange={setDepartment}
              options={[
                { value: "all", label: "Tutti i reparti" },
                ...departments.map(([id, name]) => ({ value: id, label: name })),
              ]}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState>
            {documents.length === 0
              ? "Nessun documento in archivio. Usa Aggiungi documento per registrarne uno."
              : "Nessun documento corrisponde ai filtri."}
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface md:hidden">
              {page.map((d) => (
                <li key={d.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/people/anagrafica/${d.employeeId}`} className="font-medium hover:underline">
                        {d.employeeName}
                      </Link>
                      <p className="text-xs text-muted">{d.departmentName}</p>
                    </div>
                    <Chip size="sm" variant="soft" color={DOCUMENT_STATUS[d.status].color} className="shrink-0 whitespace-nowrap">
                      {DOCUMENT_STATUS[d.status].label}
                    </Chip>
                  </div>
                  <Link href={`/people/documenti/${d.id}`} className="break-words hover:underline">
                    <span className="text-muted">{categoryLabels[d.category]}: </span>
                    {d.title}
                  </Link>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-muted tabular-nums">
                      {d.expiresAt ? `Scade il ${formatDate(d.expiresAt)}` : "Senza scadenza"}
                    </span>
                    {d.isCertificate ? (
                      <span className="text-xs text-muted">Da formazione</span>
                    ) : (
                      <DeleteDocumentButton documentId={d.id} title={d.title} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="relative hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 font-medium">Persona</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Titolo</th>
                    <th className="px-4 py-3 font-medium">File</th>
                    <th className="px-4 py-3 font-medium">Emesso</th>
                    <th className="px-4 py-3 font-medium">Scadenza</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Azioni</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {page.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/people/anagrafica/${d.employeeId}`} className="hover:underline">
                          {d.employeeName}
                        </Link>
                        <p className="text-xs text-muted">{d.departmentName}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{categoryLabels[d.category]}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/people/documenti/${d.id}`} className="hover:underline">
                          {d.title}
                        </Link>
                      </td>
                      <td className="max-w-56 truncate px-4 py-2.5 font-mono text-xs text-muted" title={d.fileName}>
                        {d.fileName}
                      </td>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap tabular-nums">{formatDate(d.issuedAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col items-start gap-0.5">
                          {d.expiresAt ? (
                            <span className="font-mono whitespace-nowrap tabular-nums">{formatDate(d.expiresAt)}</span>
                          ) : null}
                          <Chip size="sm" variant="soft" color={DOCUMENT_STATUS[d.status].color}>
                            {DOCUMENT_STATUS[d.status].label}
                          </Chip>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          {d.isCertificate ? (
                            <span className="text-xs text-muted">Da formazione</span>
                          ) : (
                            <DeleteDocumentButton documentId={d.id} title={d.title} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visible.length > page.length && (
              <div className="flex flex-col items-center gap-1">
                <Button variant="secondary" onPress={() => setShown({ key: filterKey, count: limit + PAGE_SIZE })}>
                  Mostra altri {Math.min(PAGE_SIZE, visible.length - page.length)}
                </Button>
                <p className="text-xs text-muted">
                  {page.length} di {visible.length} documenti
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

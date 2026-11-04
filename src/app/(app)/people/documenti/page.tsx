import { Suspense } from "react";
import { Spinner } from "@heroui/react";
import DocumentsDashboard from "@/components/documents/DocumentsDashboard";

export default function DocumentiPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documenti</h1>
        <p className="text-sm text-muted">
          Contratti, idoneità mediche, attestati e informative di tutti i dipendenti, con le relative scadenze.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="grid h-40 place-items-center">
            <Spinner />
          </div>
        }
      >
        <DocumentsDashboard />
      </Suspense>
    </div>
  );
}

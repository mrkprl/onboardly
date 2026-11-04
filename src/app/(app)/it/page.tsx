import { Suspense } from "react";
import { Spinner } from "@heroui/react";
import ItDashboard from "@/components/it/ItDashboard";

export default function ItPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">IT</h1>
        <p className="text-sm text-muted">Richieste, dispositivi e licenze. Ogni azione finisce nel log.</p>
      </div>
      <Suspense
        fallback={
          <div className="grid h-40 place-items-center">
            <Spinner />
          </div>
        }
      >
        <ItDashboard />
      </Suspense>
    </div>
  );
}

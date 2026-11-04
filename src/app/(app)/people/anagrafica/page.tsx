import { Suspense } from "react";
import { Spinner } from "@heroui/react";
import EmployeeDirectory from "@/components/hr/EmployeeDirectory";

export default function AnagraficaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Anagrafica</h1>
        <p className="text-sm text-muted">Dipendenti per reparto, con contratto, orario e presenza di oggi.</p>
      </div>
      <Suspense
        fallback={
          <div className="grid h-40 place-items-center">
            <Spinner />
          </div>
        }
      >
        <EmployeeDirectory />
      </Suspense>
    </div>
  );
}

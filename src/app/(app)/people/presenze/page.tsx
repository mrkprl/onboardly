import { Suspense } from "react";
import { Spinner } from "@heroui/react";
import AttendanceDashboard from "@/components/hr/AttendanceDashboard";

export default function PresenzePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Presenze</h1>
        <p className="text-sm text-muted">Assenze di oggi, richieste da approvare, calendario e saldi per reparto.</p>
      </div>
      <Suspense
        fallback={
          <div className="grid h-40 place-items-center">
            <Spinner />
          </div>
        }
      >
        <AttendanceDashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

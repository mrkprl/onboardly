import { Suspense } from "react";
import { Spinner } from "@heroui/react";
import { TRAINING_DISCLAIMER } from "@/lib/training";
import TrainingDashboard from "@/components/training/TrainingDashboard";

export default function FormazionePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Formazione</h1>
        <p className="text-sm text-muted">
          Formazione obbligatoria sulla sicurezza: scadenze, iscrizioni alle sessioni e attestati.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="grid h-40 place-items-center">
            <Spinner />
          </div>
        }
      >
        <TrainingDashboard />
      </Suspense>
      <p className="text-xs text-muted">{TRAINING_DISCLAIMER}</p>
    </div>
  );
}

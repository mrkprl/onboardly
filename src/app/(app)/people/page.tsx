import { Suspense } from "react";
import { Spinner } from "@heroui/react";
import AgentChat from "@/components/people/AgentChat";
import PlansPanel from "@/components/people/PlansPanel";

export default function PeoplePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ingressi e uscite</h1>
        <p className="text-sm text-muted">
          Scrivi chi entra o chi esce: l&apos;assistente prepara il piano, lo esegui dopo averlo controllato.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <AgentChat />
        <Suspense
          fallback={
            <div className="grid h-40 place-items-center">
              <Spinner />
            </div>
          }
        >
          <PlansPanel />
        </Suspense>
      </div>
    </div>
  );
}

import { connection } from "next/server";
import { db } from "@/lib/db";
import { PlanPayloadSchema, StepDataSchema } from "@/lib/plans";
import PlanCard, { type PlanView } from "@/components/people/PlanCard";

export default async function PlansPanel() {
  await connection();
  const plans = await db.plan.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      employee: { include: { role: true } },
      steps: { orderBy: { position: "asc" } },
      shipment: true,
    },
  });

  const views: PlanView[] = plans.map((plan) => {
    const payload = PlanPayloadSchema.parse(plan.actions);
    const candidate = payload.candidate;
    return {
      id: plan.id,
      kind: plan.kind,
      status: plan.status,
      name: candidate
        ? `${candidate.firstName} ${candidate.lastName}`
        : `${plan.employee?.firstName} ${plan.employee?.lastName}`,
      role: candidate?.roleName ?? plan.employee?.role.name ?? "",
      team: candidate?.team ?? plan.employee?.team ?? "",
      date: candidate?.startDate ?? payload.endDate ?? "",
      returnMethod: payload.returnMethod ?? null,
      shipment: plan.shipment
        ? {
            id: plan.shipment.id,
            status: plan.shipment.status,
            trackingCode: plan.shipment.trackingCode,
            shippedAt: plan.shipment.shippedAt?.toISOString() ?? null,
          }
        : null,
      trackingCode: payload.trackingCode ?? null,
      monthlyCost: plan.steps.reduce((sum, s) => sum + (StepDataSchema.parse(s.data).monthlyCost ?? 0), 0),
      steps: plan.steps.map((s) => ({ id: s.id, label: s.label, status: s.status, detail: s.detail })),
      emailText: plan.emailText,
      firstWeekPlan: payload.firstWeekPlan ?? null,
    };
  });

  const active = views.filter((p) => p.status === "PROPOSED" || p.status === "EXECUTING");
  const history = views.filter((p) => p.status === "APPROVED" || p.status === "REJECTED");

  return (
    <section className="flex flex-col gap-4" aria-labelledby="plans-title">
      <h2 id="plans-title" className="flex items-center gap-2 font-semibold">
        Piani da approvare
        <span className="rounded-full bg-default px-2 py-0.5 font-mono text-xs">{active.length}</span>
      </h2>
      {active.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Nessun piano in attesa. Chiedi all&apos;agente di preparare un onboarding o un offboarding.
        </p>
      )}
      {active.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
      {history.length > 0 && (
        <>
          <h2 className="mt-4 font-semibold">In corso e storico</h2>
          {history.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </>
      )}
    </section>
  );
}

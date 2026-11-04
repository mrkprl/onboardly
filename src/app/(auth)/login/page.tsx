import { Suspense } from "react";
import type { Metadata } from "next";
import Logo from "@/components/Logo";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Accedi · Onboardly" };

export default function LoginPage() {
  return (
    <main className="flex min-h-[100dvh] flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="text-3xl" />
        <p className="mt-3 text-sm text-muted">Onboarding, offboarding e asset IT in un unico posto.</p>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Accedi</h1>
          <p className="mt-1 mb-5 text-sm text-muted">Entri come utente demo, con accesso a People & Culture e IT. Nessuna registrazione.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-xs text-muted">
          Progetto dimostrativo, dati di prova.
        </p>
      </div>
    </main>
  );
}

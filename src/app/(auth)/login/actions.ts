"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, demoCredentials, sessionToken } from "@/lib/session";

export type LoginState = { error: string | null };

// Solo percorsi interni: next arriva dall'URL e non deve poter portare su un altro sito
const safeNext = (value: FormDataEntryValue | null) => {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
};

// Demo pubblica: un clic e si entra come utente demo, senza password da digitare
export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const credentials = demoCredentials();
  const next = safeNext(form.get("next"));
  if (!credentials) redirect(next);

  (await cookies()).set(SESSION_COOKIE, await sessionToken(credentials.user, credentials.password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next);
}

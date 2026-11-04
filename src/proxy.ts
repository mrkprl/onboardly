import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, demoCredentials, safeEqual, sessionToken } from "@/lib/session";

// Protezione della demo pubblicata: attiva solo se DEMO_PASSWORD è impostata (in locale resta aperta).
// Il link di conferma spedizione resta pubblico: lo apre il dipendente uscito, che non ha credenziali.
export async function proxy(request: NextRequest) {
  const credentials = demoCredentials();
  if (!credentials) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await sessionToken(credentials.user, credentials.password))) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessione scaduta: accedi di nuovo" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|spedizione/|_vercel/|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|ico|webp)$).*)"],
};

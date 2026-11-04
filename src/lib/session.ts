// Sessione della demo pubblicata: un cookie con la firma HMAC dell'utente, verificabile senza database.
// Usa Web Crypto, disponibile sia nel proxy sia nelle server action.
export const SESSION_COOKIE = "ob_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export const demoCredentials = () =>
  process.env.DEMO_PASSWORD ? { user: process.env.DEMO_USER ?? "demo", password: process.env.DEMO_PASSWORD } : null;

export async function sessionToken(user: string, password: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`onboardly:${user}`));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

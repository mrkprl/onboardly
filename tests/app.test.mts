import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "../src/app/manifest.ts";
import { safeEqual, sessionToken } from "../src/lib/session.ts";

const ROOT = join(import.meta.dirname, "..");

test("il manifest usa il nome dell'app", () => {
  const m = manifest();
  assert.equal(m.name, "Onboardly");
  assert.equal(m.short_name, "Onboardly");
});

test("la pagina di accesso mostra l'avviso demo", () => {
  const page = readFileSync(join(ROOT, "src/app/(auth)/login/page.tsx"), "utf8");
  assert.match(page, /Progetto dimostrativo, dati di prova/);
});

test("il token di sessione dipende da utente e password", async () => {
  const a = await sessionToken("demo", "uno");
  assert.equal(a, await sessionToken("demo", "uno"));
  assert.notEqual(a, await sessionToken("demo", "due"));
  assert.notEqual(a, await sessionToken("altro", "uno"));
  assert.ok(safeEqual(a, a));
  assert.ok(!safeEqual(a, a.slice(1)));
});

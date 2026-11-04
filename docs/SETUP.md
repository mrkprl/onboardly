# Setup Onboardly

## Variabili (`.env.local`, modello in `.env.example`)

- `DATABASE_URL`: Neon Postgres, region `aws-eu-central-1` (Frankfurt)
- `ANTHROPIC_API_KEY`: Claude API (modello `claude-sonnet-5-5`)

## Comandi

```bash
npm install            # esegue anche prisma generate
npx prisma migrate dev # applica le migrazioni
npm run db:seed        # ricarica i dati demo (cancella tutto il resto)
npm run dev
```

## Gotcha

- **Prisma 7**: la CLI non legge `.env.local` da sola, lo carica `prisma.config.ts` con dotenv. Dopo `migrate dev` lanciare `npx prisma generate`.
- **Prisma su npm**: il tag `latest` punta a una release candidate della 8; il progetto è fissato a 7.10.1.
- **Neon scale-to-zero**: dopo un periodo di inattività il primo accesso impiega alcuni secondi. Con il `maxWait` di default (2s) le transazioni falliscono con "Unable to start a transaction in the given time". Per questo `src/lib/db.ts` imposta `maxWait: 15000`, `timeout: 20000`.
- **Porta 3000**: sulla macchina di sviluppo può essere occupata da Docker; usare `npm run dev -- --port 3210`.
- **Date e ora legale**: le assenze sono salvate come giorni a mezzanotte UTC (`parseDay`); nel seed i giorni relativi si calcolano sul calendario (`Date.UTC(y, m, d + n)`), non sommando millisecondi, altrimenti al cambio dell'ora legale si sbaglia giorno. "Oggi" lato server: `isoDateRome()`.
- **Label in moduli con `db`**: `src/lib/hr.ts`, `training.ts`, `documents.ts` importano Prisma, quindi i client component non possono importarne le costanti; le etichette vanno passate come props o duplicate in `src/components/*/constants.ts`.

## Deploy su Vercel

- Funzioni in `fra1` (Francoforte, `vercel.json`). Il database Neon è lo stesso dell'ambiente locale (`aws-eu-central-1`).
- Variabili di produzione: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `DEMO_PASSWORD` (e facoltativa `DEMO_USER`, default `demo`).
- Con `DEMO_PASSWORD` impostata, `src/proxy.ts` manda a `/login` chi non ha il cookie di sessione. La pagina ha un solo bottone "Entra nella demo" che imposta il cookie senza chiedere la password: la password serve solo a firmarlo (HMAC dell'utente con la password, `src/lib/session.ts`, valido 7 giorni); le API rispondono 401. Resta pubblico `/spedizione/*`, il link del dipendente in uscita. Cambiare la password invalida tutte le sessioni.
- Le migrazioni non partono nel build: prima di un deploy che le contiene lanciare `npx prisma migrate deploy` in locale.
- **Fuso orario**: su Vercel il server è in UTC. Date e orari passano da `romeDateTime()` / `isoDateRome()` e i formatter hanno `timeZone: "Europe/Rome"`; non usare `setHours` o `getDate` locali.
- **Claude API**: le richieste all'assistente sono elaborate da Anthropic, non in una region UE dedicata. Nella demo i dati sono tutti finti.
- **`vercel link`** aggiunge `VERCEL_OIDC_TOKEN` a `.env.local` (non tocca le altre variabili).

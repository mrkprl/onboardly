# Onboardly — specifica v1

> Agente AI per onboarding/offboarding con area IT per dispositivi e licenze.
> Progetto dimostrativo, dati di prova.

## Obiettivo

People & Culture scrive in linguaggio naturale ("Lunedì entra Giulia, designer nel team Growth, vuole un Mac").
L'agente prepara un piano (device, account, licenze, checklist, mail di benvenuto), HR lo approva, il sistema lo esegue.
Se mancano risorse (device o posti licenza) il sistema apre una richiesta all'IT.
L'IT ha la sua area per gestire inventario, licenze e richieste.

## Principi

1. **L'AI propone, il codice esegue.** L'agente usa solo tool di lettura e un tool che *propone* un piano.
   L'esecuzione avviene lato server, in modo deterministico, solo dopo l'approvazione umana.
2. **Le regole sono dati, non prompt.** Ruolo → licenze, requisiti hardware e scorte stanno nel DB.
3. **Ogni azione finisce nel log** (chi, cosa, quando).
4. **Integrazioni esterne simulate** (Google Workspace, Slack, MDM): producono log realistici; notifica Slack reale facoltativa.

## Aree

| Area | Utente | Contenuto |
|---|---|---|
| `/people` | People & Culture | chat con l'agente, piani in attesa di approvazione, stato onboarding/offboarding |
| `/it` | IT | richieste aperte, inventario dispositivi, licenze (posti, costi, rinnovi), log |

Accesso demo: selettore "Entra come People & Culture / IT", nessuna auth reale.

## Flussi

### Onboarding
1. HR scrive la richiesta → l'agente estrae nome, ruolo, team, data inizio, OS preferito (chiede ciò che manca).
2. Legge il profilo ruolo (licenze, RAM minima, OS di default).
3. Cerca un device `AVAILABLE` compatibile (OS + RAM ≥ minimo).
   - **Trovato** → nel piano: prenotazione del device.
   - **Non trovato** → nel piano: richiesta IT `DEVICE_PROCUREMENT` con scadenza = data inizio − 3 giorni lavorativi.
4. Per ogni licenza del ruolo controlla i posti liberi.
   - Posti liberi → assegnazione.
   - Esauriti → richiesta IT `LICENSE_SEATS`.
5. Genera mail di benvenuto e piano prima settimana (testo AI).
6. Mostra il piano → HR approva o rifiuta.
7. All'approvazione: device `RESERVED`, licenze assegnate, account "creati" (simulato), checklist IT generata, richieste IT aperte, notifica.
8. L'IT prepara il device e lo segna `ASSIGNED` → dipendente `ACTIVE`.

### Offboarding
1. HR scrive "X lascia venerdì" → l'agente trova il dipendente.
2. Piano: revoca account, rilascio licenze (con risparmio €/mese), recupero device.
3. All'approvazione: licenze rilasciate, account revocati (simulato) alla data di uscita, device `TO_RECOVER`, richiesta IT `DEVICE_RETURN`.
4. L'IT segna il device ricevuto e resettato → `AVAILABLE` (o `RETIRED`).

### Area IT
- Richieste ordinate per scadenza, con priorità calcolata dai giorni rimanenti (≤3 alta, ≤7 media, altrimenti bassa).
- Chiusura richiesta: per `DEVICE_PROCUREMENT` l'IT registra il nuovo device, che viene assegnato all'onboarding in attesa.
- Inventario: filtri per stato/OS, cambio stato manuale (es. `IN_REPAIR`).
- Licenze: posti usati/totali, costo mensile, rinnovi entro 30 giorni, posti inutilizzati.

## Modello dati (Prisma, bozza)

```prisma
enum EmployeeStatus { ONBOARDING ACTIVE OFFBOARDING LEFT }
enum Os { MACOS WINDOWS }
enum DeviceStatus { AVAILABLE RESERVED ASSIGNED TO_RECOVER IN_REPAIR RETIRED }
enum PlanKind { ONBOARDING OFFBOARDING }
enum PlanStatus { PROPOSED APPROVED REJECTED }
enum ItRequestType { DEVICE_PROCUREMENT LICENSE_SEATS DEVICE_RETURN DEVICE_SETUP }
enum ItRequestStatus { OPEN IN_PROGRESS DONE }

model RoleProfile {
  id        String  @id @default(cuid())
  name      String  @unique          // es. "Product Designer"
  defaultOs Os
  minRamGb  Int
  licenses  RoleLicense[]
  employees Employee[]
}

model RoleLicense {
  roleId    String
  licenseId String
  role      RoleProfile @relation(fields: [roleId], references: [id])
  license   License     @relation(fields: [licenseId], references: [id])
  @@id([roleId, licenseId])
}

model Employee {
  id        String         @id @default(cuid())
  firstName String
  lastName  String
  email     String         @unique
  team      String
  roleId    String
  role      RoleProfile    @relation(fields: [roleId], references: [id])
  status    EmployeeStatus
  startDate DateTime
  endDate   DateTime?
  devices   Device[]
  licenses  LicenseAssignment[]
  plans     Plan[]
  requests  ItRequest[]
}

model Device {
  id           String       @id @default(cuid())
  model        String       // es. "MacBook Pro 14 M4"
  os           Os
  ramGb        Int
  serial       String       @unique
  status       DeviceStatus
  assignedToId String?
  assignedTo   Employee?    @relation(fields: [assignedToId], references: [id])
  requests     ItRequest[]
}

model License {
  id                String   @id @default(cuid())
  product           String   @unique   // es. "Figma"
  totalSeats        Int
  monthlyCostPerSeat Decimal
  renewalDate       DateTime
  assignments       LicenseAssignment[]
  roles             RoleLicense[]
  requests          ItRequest[]
}

model LicenseAssignment {
  id         String    @id @default(cuid())
  licenseId  String
  employeeId String
  assignedAt DateTime  @default(now())
  revokedAt  DateTime?
  license    License   @relation(fields: [licenseId], references: [id])
  employee   Employee  @relation(fields: [employeeId], references: [id])
}

model Plan {
  id          String     @id @default(cuid())
  kind        PlanKind
  status      PlanStatus @default(PROPOSED)
  employeeId  String
  employee    Employee   @relation(fields: [employeeId], references: [id])
  actions     Json       // azioni strutturate validate con zod
  welcomeText String?
  createdAt   DateTime   @default(now())
  decidedAt   DateTime?
}

model ItRequest {
  id         String          @id @default(cuid())
  type       ItRequestType
  status     ItRequestStatus @default(OPEN)
  dueDate    DateTime
  note       String
  employeeId String?
  deviceId   String?
  licenseId  String?
  employee   Employee? @relation(fields: [employeeId], references: [id])
  device     Device?   @relation(fields: [deviceId], references: [id])
  license    License?  @relation(fields: [licenseId], references: [id])
  createdAt  DateTime  @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  actor     String   // "agent", "people", "it", "system"
  action    String
  payload   Json
  createdAt DateTime @default(now())
}
```

## Tool dell'agente

| Tool | Tipo | Cosa fa |
|---|---|---|
| `listRoleProfiles` | lettura | ruoli disponibili e relative licenze |
| `findEmployee` | lettura | cerca per nome/email |
| `checkDeviceAvailability` | lettura | device disponibili per OS e RAM minima |
| `checkLicenseSeats` | lettura | posti liberi per licenza |
| `proposeOnboardingPlan` | proposta | crea `Plan` PROPOSED (nessun effetto su device/licenze) |
| `proposeOffboardingPlan` | proposta | idem per uscita |

L'esecuzione (`approvePlan`) è una server action chiamata dal pulsante di HR, non un tool dell'agente.

## Stack

- Next.js (App Router) + TypeScript + Tailwind, deploy Vercel `fra1`
- Postgres su Neon (region UE) + Prisma
- Claude API con tool use (modello: claude-sonnet-5-5)
- UI: HeroUI v3 (React Aria + Tailwind v4)
- zod per validare le azioni del piano

## Dati seed

- 4 ruoli: Software Engineer, Product Designer, Customer Success, People Specialist
- 6 licenze: Google Workspace, Slack, Notion, Figma, GitHub, HubSpot (alcune quasi esaurite)
- ~12 device, misti Mac/Windows, con almeno un caso "nessun Mac da 32GB disponibile"
- ~10 dipendenti attivi

## Fuori perimetro v1

Helpdesk/bot di supporto, auth reale, integrazioni reali (salvo notifica Slack facoltativa), multi-azienda.

## Da verificare

- Region di elaborazione della Claude API: con dati finti va bene per la demo; in produzione serve una valutazione GDPR.

## v1.1 — Step eseguibili, telefoni e riconsegna (17 ott 2026)

- Ogni piano è una lista di `PlanStep` (PENDING → DONE / WAITING_IT / FAILED). L'esecuzione avviene step per step via `POST /api/plans/[id]/execute` (stream NDJSON), con UI che spunta gli step in tempo reale. Se uno step fallisce il piano resta `EXECUTING` e si può riprendere.
- Gli step che dipendono dall'IT restano `WAITING_IT` finché la richiesta collegata non viene completata; quando tutti gli step sono `DONE` il dipendente passa ad `ACTIVE` (ingresso) o `LEFT` (uscita).
- Device di tipo `LAPTOP` o `PHONE` (iOS/Android). I ruoli con `needsPhone` ricevono anche un telefono.
- Dipendenti con `workMode` (OFFICE/REMOTE) e indirizzo. In uscita: remoto → etichetta di spedizione prepagata (`/labels/[id]`, simulata) e mail con istruzioni; ufficio → mail che chiede la riconsegna entro l'ultimo giorno o il primo giorno utile in sede.
- Integrazioni esterne (account, mail, backup Drive, corriere) simulate con una breve latenza.

## v1.2 — Conferma spedizione dal dipendente (17 ott 2026)

- La mail di uscita (riconsegna via corriere) mostra l'etichetta come allegato e contiene un link personale `/spedizione/[token]` (token casuale da 128 bit).
- Dalla pagina il dipendente indica data di consegna al corriere e una nota; la spedizione passa `LABEL_CREATED → SHIPPED`, gli step di recupero mostrano "Spedito il …, in transito" e l'IT lo vede nelle richieste. Quando l'IT segna tutti i device come rientrati la spedizione diventa `DELIVERED`.
- Le pagine per il dipendente stanno nel gruppo `(public)`: niente navigazione interna.
- Date "di oggi" calcolate nel fuso Europe/Rome (`isoDateRome`), non in UTC.

## v1.3 · Modulo HR e rifinitura UI (17 ott 2026)

- **Panoramica** (`/`): cosa c'è da fare (piani, assenze da decidere, richieste IT, formazione da sistemare, documenti in scadenza), ingressi, uscite, assenze.
- **People & Culture** a sezioni: Ingressi e uscite, Anagrafica, Presenze, Formazione, Documenti.
- **Anagrafica**: reparti (IT, Prodotto, Sales, Customer Success, People & Culture), contratto (tipo, livello CCNL, scadenza), orario (`WorkSchedule`), modalità di lavoro, ruoli di sicurezza. Profilo con saldi, richieste, corsi, documenti.
- **Presenze**: saldi ferie/ROL/ex festività in ore (spettanze indicative CCNL Commercio, riproporzionate sull'orario), richieste con controllo di saldo e sovrapposizioni, calendario per reparto con festività nazionali.
- **Formazione sicurezza** (D.Lgs. 81/2008, valori indicativi da verificare con l'RSPP): corsi base e aggiornamenti, requisiti per ruolo (tutti, primo soccorso, antincendio, preposto, RLS), sessioni, iscrizioni, completamento con attestato.
- **Documenti**: contratto, privacy, regolamento, idoneità medica, attestati; scadenze; file simulati con anteprima stampabile.
- **Collegamenti**: l'onboarding crea saldi, documenti di assunzione e iscrizioni ai corsi obbligatori; l'offboarding calcola le ore da liquidare e annulla i corsi futuri.
- **UI**: linee guida in `docs/DESIGN.md` (icone Phosphor, niente trattini lunghi, emoji o pallini decorativi).

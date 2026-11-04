# Onboardly · linee guida UI

Strumento interno HR/IT. Tono sobrio, B2B, in stile Linear: un prodotto da usare ogni giorno.

## Stack UI

- HeroUI v3 (`@heroui/react`): componenti composti (`Card.Header`, `Tabs.Tab`, `Chip`, `Button`, `Input`, `TextArea`, `Alert`, `Spinner`). Nessun provider.
- Tailwind v4 con i token di HeroUI: `bg-background`, `bg-surface`, `bg-surface-secondary`, `bg-default`, `text-foreground`, `text-muted`, `border-border`, `text-accent`, `bg-success`/`warning`/`danger` e varianti `-soft`.
- Icone: solo Phosphor. Client: `import { CheckIcon } from "@phosphor-icons/react"`. Server: `import { CheckIcon } from "@phosphor-icons/react/ssr"`. Nomi con suffisso `Icon`. Dimensione 16 (`size={16}`), peso `regular`. Mai SVG disegnati a mano.
- Font: Geist e Geist Mono (già configurati). Numeri, codici e importi in `font-mono tabular-nums`.

## Regole di stile

- Zero trattini lunghi `—` o `–` nel testo visibile. Celle vuote: `-` oppure una parola ("Nessuno").
- Il punto `·` al massimo uno per riga. Meglio colonne o righe separate.
- Niente emoji, niente pallini colorati decorativi. Il colore serve solo a uno stato reale (chip di stato).
- Niente sopratitoli mono maiuscoli sopra ogni titolo. Il titolo basta.
- Copy funzionale e concreto. Niente slogan, niente "elegante", "senza sforzo", "potenzia".
- Un solo accento (quello di HeroUI). Raggi: card `rounded-2xl`, input e bottoni quelli di HeroUI, chip pill.
- Tabelle: intestazioni `text-xs text-muted`, righe separate con `divide-y divide-border`, nessun bordo doppio.
- Stati vuoti con frase che spiega come popolarli. Errori inline sotto il campo.
- Label sopra l'input, mai placeholder al posto della label.
- Dark mode: usare solo i token, mai colori fissi.

## Struttura pagine

- Titolo pagina `text-2xl font-semibold tracking-tight` + una riga `text-sm text-muted`.
- Contenuto in `flex flex-col gap-6`.
- Pagine con dati dal DB: componente async con `await connection()` dentro `<Suspense>` (Next 16 con `cacheComponents`).
- Azioni server: file `actions.ts` colocato, validazione zod, ritorno `{ ok: true } | { ok: false; error }`, `revalidatePath` delle pagine toccate, audit log tramite le funzioni in `src/lib`.
- Testi e messaggi di errore in italiano.

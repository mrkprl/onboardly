// Gli errori di dominio di src/lib sono Error semplici; quelli di Prisma e zod sono in inglese e non vanno mostrati
export function errorMessage(error: unknown) {
  if (error instanceof Error && error.name === "Error") return error.message;
  console.error(error);
  return "Operazione non riuscita: ricarica la pagina e riprova";
}

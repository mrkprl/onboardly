"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import { decideLeaveRequest } from "@/lib/hr";

type ActionResult = { ok: true } | { ok: false; error: string };

const DecisionSchema = z.object({
  requestId: z.string().min(1, "Richiesta non valida"),
  approve: z.boolean(),
});

export async function decideLeaveRequestAction(requestId: string, approve: boolean): Promise<ActionResult> {
  const parsed = DecisionSchema.safeParse({ requestId, approve });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await decideLeaveRequest(parsed.data.requestId, parsed.data.approve);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/people/presenze");
  revalidatePath("/people/anagrafica");
  revalidatePath("/people/anagrafica/[id]", "page");
  return { ok: true };
}

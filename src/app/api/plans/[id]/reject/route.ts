import { errorMessage } from "@/lib/errors";
import { rejectPlan } from "@/lib/plans";

export async function POST(_request: Request, ctx: RouteContext<"/api/plans/[id]/reject">) {
  const { id } = await ctx.params;
  try {
    await rejectPlan(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 409 });
  }
}

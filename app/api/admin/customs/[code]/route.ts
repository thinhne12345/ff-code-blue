import { requireAdmin } from "../../../../lib/auth";
import { deleteCustom } from "../../../../lib/db";
import { apiError } from "../../../../lib/http";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { code } = await context.params;
    await deleteCustom(decodeURIComponent(code));
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

import { requireAdmin } from "../../../../lib/auth";
import { setSubmissionColor } from "../../../../lib/db";
import { apiError } from "../../../../lib/http";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const color = await setSubmissionColor(id, payload.color);
    return Response.json({ color });
  } catch (error) {
    return apiError(error);
  }
}

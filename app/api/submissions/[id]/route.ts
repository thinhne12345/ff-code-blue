import { updateSubmission } from "../../../lib/db";
import { apiError } from "../../../lib/http";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const submission = await updateSubmission(id, payload.editToken, payload);
    return Response.json({ submission });
  } catch (error) {
    return apiError(error);
  }
}

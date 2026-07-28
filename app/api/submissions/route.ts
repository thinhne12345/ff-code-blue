import { createSubmission } from "../../lib/db";
import { apiError } from "../../lib/http";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const submission = await createSubmission(payload.customCode, payload);
    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

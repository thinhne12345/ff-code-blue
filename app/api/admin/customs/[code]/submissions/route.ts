import { requireAdmin } from "../../../../../lib/auth";
import {
  clearCustomSubmissions,
  createSubmission,
  listSubmissions,
} from "../../../../../lib/db";
import { apiError } from "../../../../../lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { code } = await context.params;
    return Response.json({
      submissions: await listSubmissions(decodeURIComponent(code)),
    });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { code } = await context.params;
    const payload = await request.json();
    const inputs = Array.isArray(payload.submissions)
      ? payload.submissions
      : [];
    if (!inputs.length) throw new Error("Chưa có team để nạp.");
    const saved = [];
    for (const input of inputs) {
      saved.push(
        await createSubmission(decodeURIComponent(code), {
          ...input,
          color: input.color || "#000000",
        }),
      );
    }
    return Response.json({ saved }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { code } = await context.params;
    const deleted = await clearCustomSubmissions(decodeURIComponent(code));
    return Response.json({ deleted });
  } catch (error) {
    return apiError(error);
  }
}

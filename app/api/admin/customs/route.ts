import { requireAdmin } from "../../../lib/auth";
import { addCustom, listCustoms } from "../../../lib/db";
import { apiError } from "../../../lib/http";

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return Response.json({ customs: await listCustoms() });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const payload = await request.json();
    const code = await addCustom(payload.code);
    return Response.json({ code }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

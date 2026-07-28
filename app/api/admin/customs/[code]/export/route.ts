import { requireAdmin } from "../../../../../lib/auth";
import { exportCustom } from "../../../../../lib/db";
import { apiError } from "../../../../../lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { code } = await context.params;
    const customCode = decodeURIComponent(code);
    const data = await exportCustom(customCode);
    const safeName =
      customCode.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-") || "custom";
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.json"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

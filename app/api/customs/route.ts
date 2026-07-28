import { listCustoms } from "../../lib/db";
import { apiError } from "../../lib/http";

export async function GET() {
  try {
    const customs = await listCustoms();
    return Response.json({
      customs: customs.map((custom) => custom.code),
    });
  } catch (error) {
    return apiError(error, 500);
  }
}

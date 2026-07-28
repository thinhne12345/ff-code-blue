import { loginCookie, passwordMatches } from "../../../lib/auth";
import { apiError } from "../../../lib/http";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!(await passwordMatches(payload.password))) {
      return Response.json(
        { error: "Mật khẩu ADMIN không đúng." },
        { status: 401 },
      );
    }
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": await loginCookie() } },
    );
  } catch (error) {
    return apiError(error);
  }
}

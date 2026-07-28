import { isAdmin } from "../../../lib/auth";

export async function GET(request: Request) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  return Response.json({ ok: true });
}

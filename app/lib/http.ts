export function apiError(error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
  return Response.json({ error: message }, { status });
}

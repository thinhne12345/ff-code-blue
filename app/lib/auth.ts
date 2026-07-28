type RuntimeEnv = {
  ADMIN_PASSWORD?: string;
};

export const ADMIN_COOKIE = "ff_code_admin";
const DEFAULT_PASSWORD_HASH =
  "ac077b4f993945490eda82e92889fd89150a70c62affd8ea781641ec96a58149";

function configuredPassword(): string {
  const nodePassword =
    typeof process !== "undefined" ? process.env.ADMIN_PASSWORD : "";
  const runtime = globalThis as typeof globalThis & {
    __FF_RUNTIME_ENV?: RuntimeEnv;
  };
  return String(
    nodePassword || runtime.__FF_RUNTIME_ENV?.ADMIN_PASSWORD || "",
  );
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sessionToken(): Promise<string> {
  const secret = configuredPassword() || DEFAULT_PASSWORD_HASH;
  return sha256(`ff-code-blue:${secret}`);
}

function readCookie(request: Request, name: string): string {
  const cookies = request.headers.get("cookie") ?? "";
  const item = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

export async function passwordMatches(value: unknown): Promise<boolean> {
  const suppliedHash = await sha256(String(value ?? ""));
  const configured = configuredPassword();
  const expectedHash = configured
    ? await sha256(configured)
    : DEFAULT_PASSWORD_HASH;
  return suppliedHash === expectedHash;
}

export async function isAdmin(request: Request): Promise<boolean> {
  return readCookie(request, ADMIN_COOKIE) === (await sessionToken());
}

export async function requireAdmin(
  request: Request,
): Promise<Response | null> {
  if (await isAdmin(request)) return null;
  return Response.json(
    { error: "Phiên ADMIN không hợp lệ hoặc đã hết hạn." },
    { status: 401 },
  );
}

export async function loginCookie(): Promise<string> {
  return `${ADMIN_COOKIE}=${encodeURIComponent(await sessionToken())}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

export function logoutCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

import { requireAdmin } from "../../../../../lib/auth";
import { exportCustom } from "../../../../../lib/db";
import { apiError } from "../../../../../lib/http";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
    const region = data.TeamRegionList[0]?.TeamRegion ?? "";
    const rows = data.PlayerNameList.map(
      (player, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><code>${escapeHtml(player.PlayerID)}</code></td>
          <td><strong>${escapeHtml(player.PlayerNameOverwrite)}</strong></td>
          <td>${escapeHtml(player.PlayerNation)}</td>
          <td><span class="swatch" style="background:${escapeHtml(player.Color)}"></span>${escapeHtml(player.Color)}</td>
        </tr>`,
    ).join("");
    const json = escapeHtml(JSON.stringify(data, null, 2));
    const downloadUrl = `/api/admin/customs/${encodeURIComponent(customCode)}/export`;

    const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PlayerNameOverwrite - ${escapeHtml(customCode)}</title>
  <style>
    :root{color-scheme:dark;--line:#2b72a6;--muted:#9cb9cf;--blue:#62d4ff}
    *{box-sizing:border-box} body{margin:0;color:#eef8ff;font-family:Inter,Segoe UI,sans-serif;background:radial-gradient(circle at 10% 0,#1267a8 0,transparent 35rem),linear-gradient(145deg,#061f42,#03152c);min-height:100vh}
    main{width:min(1120px,calc(100% - 28px));margin:auto;padding:32px 0 60px}
    header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px}
    .eyebrow{color:var(--blue);font-size:11px;font-weight:800;letter-spacing:.14em}
    h1{margin:6px 0 5px;font-size:clamp(30px,5vw,52px);letter-spacing:-.04em}
    p{margin:0;color:var(--muted);line-height:1.6}
    a{display:inline-flex;align-items:center;min-height:42px;border:1px solid #73dfff;border-radius:11px;padding:0 16px;color:white;background:linear-gradient(135deg,#27b7f2,#0870c4);font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}
    .card{overflow:hidden;border:1px solid rgba(98,203,255,.28);border-radius:18px;background:rgba(4,27,55,.82);box-shadow:0 24px 70px rgba(0,8,24,.4)}
    .summary{display:flex;gap:28px;padding:16px 18px;border-bottom:1px solid rgba(98,203,255,.18)}
    .summary span{display:block;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.1em}
    .summary strong{display:block;margin-top:4px;font-size:18px}
    .table-wrap{overflow:auto} table{width:100%;border-collapse:collapse;min-width:720px}
    th,td{padding:12px 14px;border-bottom:1px solid rgba(98,203,255,.11);text-align:left;font-size:13px}
    th{color:#a9c8dd;background:rgba(22,95,145,.16);font-size:10px;letter-spacing:.09em}
    td:first-child{color:#6da7ca;width:55px} code{color:var(--blue)}
    .swatch{display:inline-block;width:10px;height:10px;border:1px solid #fff5;border-radius:50%;margin-right:7px}
    details{margin-top:16px;border:1px solid rgba(98,203,255,.24);border-radius:14px;background:rgba(4,27,55,.72)}
    summary{padding:14px 16px;color:var(--blue);cursor:pointer;font-weight:800}
    pre{max-height:560px;overflow:auto;margin:0;border-top:1px solid rgba(98,203,255,.15);padding:16px;color:#cfeeff;font:12px/1.55 Consolas,monospace;white-space:pre-wrap}
    .empty{padding:36px;text-align:center;color:var(--muted)}
    @media(max-width:650px){header{align-items:flex-start;flex-direction:column}.summary{flex-direction:column;gap:12px}}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <span class="eyebrow">XEM TRỰC TIẾP TRÊN WEB</span>
        <h1>PlayerNameOverwrite</h1>
        <p>Custom ${escapeHtml(customCode)} · TeamRegion ${escapeHtml(region)}</p>
      </div>
      <a href="${downloadUrl}">Tải file JSON</a>
    </header>
    <section class="card">
      <div class="summary">
        <div><span>TEAM REGION</span><strong>${escapeHtml(region)}</strong></div>
        <div><span>NGƯỜI CHƠI</span><strong>${data.PlayerNameList.length}</strong></div>
        <div><span>TEAM ID</span><strong>15 slot</strong></div>
      </div>
      <div class="table-wrap">
        ${
          rows
            ? `<table><thead><tr><th>#</th><th>PLAYER ID</th><th>PLAYER NAME OVERWRITE</th><th>PLAYER NATION</th><th>COLOR</th></tr></thead><tbody>${rows}</tbody></table>`
            : `<div class="empty">Custom này chưa có người chơi.</div>`
        }
      </div>
    </section>
    <details>
      <summary>Xem JSON đầy đủ</summary>
      <pre>${json}</pre>
    </details>
  </main>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return apiError(error);
  }
}

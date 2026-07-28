"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatPlayerName,
  formatTeamRegion,
  normalizeVisibleText,
  parseQuickInput,
} from "./lib/names";

type View = "home" | "team" | "admin";
type Notice = { message: string; tone: "info" | "ok" | "error" };
type Member = { key: string; playerId: string; ingame: string };
type AdminCustom = {
  code: string;
  color: string;
  team_count: number;
  player_count: number;
};
type AdminSubmission = {
  id: string;
  teamName: string;
  color: string;
  members: Array<{
    id: number;
    playerId: string;
    ingame: string;
    playerName: string;
  }>;
};
type BulkTeam = {
  teamName: string;
  color: string;
  members: Array<{ playerId: string; ingame: string }>;
};

const emptyNotice: Notice = {
  message: "Chọn một custom để nhập danh sách team.",
  tone: "info",
};

function memberKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function blankMember(): Member {
  return { key: memberKey(), playerId: "", ingame: "" };
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || "Không thể kết nối máy chủ.");
  }
  return data;
}

function NoticeBox({ notice }: { notice: Notice }) {
  return (
    <div className={`notice ${notice.tone}`} role="status">
      <span className="notice-dot" />
      {notice.message}
    </div>
  );
}

export default function CodePortal() {
  const [view, setView] = useState<View>("home");
  const [customs, setCustoms] = useState<string[]>([]);
  const [selectedCustom, setSelectedCustom] = useState("");
  const [homeNotice, setHomeNotice] = useState<Notice>(emptyNotice);
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<Member[]>([
    blankMember(),
    blankMember(),
    blankMember(),
    blankMember(),
  ]);
  const [quickInput, setQuickInput] = useState("");
  const [teamNotice, setTeamNotice] = useState<Notice>({
    message: "Nhập tên team, ID và tên game rồi gửi về ADMIN.",
    tone: "info",
  });
  const [busy, setBusy] = useState(false);

  const loadCustoms = useCallback(async () => {
    try {
      const data = await api<{ customs: string[] }>("/api/customs");
      setCustoms(data.customs);
      setHomeNotice({
        message: `${data.customs.length} custom đang sẵn sàng.`,
        tone: "ok",
      });
    } catch (error) {
      setHomeNotice({
        message: error instanceof Error ? error.message : "Không tải được custom.",
        tone: "error",
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCustoms(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCustoms]);

  const selectCustom = (custom: string) => {
    setSelectedCustom(custom);
    setView("team");
    setTeamNotice({
      message: `Đang nhập danh sách cho custom ${custom}.`,
      tone: "info",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateMember = (
    key: string,
    field: "playerId" | "ingame",
    value: string,
  ) => {
    setMembers((current) =>
      current.map((member) =>
        member.key === key ? { ...member, [field]: value } : member,
      ),
    );
  };

  const readQuickInput = () => {
    const parsed = parseQuickInput(quickInput);
    if (parsed.teamName) setTeamName(parsed.teamName);
    if (!parsed.members.length) {
      setTeamNotice({
        message: "Chưa đọc được dòng nào. Mỗi dòng cần có ID và tên game.",
        tone: "error",
      });
      return;
    }
    setMembers(
      parsed.members.map((member) => ({
        key: memberKey(),
        ...member,
      })),
    );
    setTeamNotice({
      message: `Đã đọc ${parsed.members.length} thành viên và giữ nguyên chữ hoa/thường.`,
      tone: "ok",
    });
  };

  const payload = useMemo(
    () => ({
      customCode: selectedCustom,
      teamName,
      members: members
        .filter((member) => member.playerId.trim() || member.ingame.trim())
        .map(({ playerId, ingame }) => ({ playerId, ingame })),
    }),
    [members, selectedCustom, teamName],
  );

  const submitTeam = async (update = false) => {
    setBusy(true);
    try {
      if (
        quickInput.trim() &&
        (!teamName.trim() ||
          !members.some(
            (member) => member.playerId.trim() && member.ingame.trim(),
          ))
      ) {
        readQuickInput();
        throw new Error(
          "Đã đọc ô nhập nhanh. Hãy kiểm tra kết quả rồi bấm gửi lại.",
        );
      }

      const ticketKey = `ff-code-ticket:${selectedCustom}`;
      if (update) {
        const ticket = JSON.parse(localStorage.getItem(ticketKey) || "null") as
          | { id: string; editToken: string }
          | null;
        if (!ticket) {
          throw new Error("Chưa có phiếu đã gửi để cập nhật.");
        }
        const data = await api<{ submission: { teamName: string } }>(
          `/api/submissions/${encodeURIComponent(ticket.id)}`,
          {
            method: "PUT",
            body: JSON.stringify({ ...payload, editToken: ticket.editToken }),
          },
        );
        setTeamNotice({
          message: `Đã cập nhật team ${data.submission.teamName}.`,
          tone: "ok",
        });
      } else {
        const data = await api<{
          submission: { id: string; editToken: string; teamName: string };
        }>("/api/submissions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        localStorage.setItem(
          ticketKey,
          JSON.stringify({
            id: data.submission.id,
            editToken: data.submission.editToken,
          }),
        );
        setTeamNotice({
          message: `Đã gửi team ${data.submission.teamName} về ADMIN thành công.`,
          tone: "ok",
        });
      }
    } catch (error) {
      setTeamNotice({
        message: error instanceof Error ? error.message : "Không thể gửi dữ liệu.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const openAdmin = () => {
    setView("admin");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="site-header">
        <div>
          <span className="eyebrow">FREE FIRE CUSTOM TOOL</span>
          <h1>Quản lý code tên</h1>
          <p>
            Nhập ID và tên game, kiểm tra đúng định dạng rồi gửi danh sách về
            ADMIN.
          </p>
        </div>
        <nav className="top-actions" aria-label="Điều hướng">
          <button className="button ghost" onClick={() => setView("home")}>
            Trang chủ
          </button>
          <button className="button" onClick={openAdmin}>
            ADMIN
          </button>
        </nav>
      </header>

      <section className="video-card" aria-labelledby="video-title">
        <div className="video-copy">
          <span className="step-number">HƯỚNG DẪN</span>
          <div>
            <h2 id="video-title">Cách dùng web code tên custom</h2>
            <p>Xem video trước khi nhập để tránh sai ID hoặc tên game.</p>
          </div>
        </div>
        <video
          className="guide-video"
          controls
          preload="metadata"
          playsInline
          src="/cach-dung-web-code-ten-custom-web.mp4"
        >
          Trình duyệt của bạn không hỗ trợ phát video.
        </video>
      </section>

      {view === "home" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">BƯỚC 1</span>
              <h2>Chọn custom</h2>
            </div>
            <p>Chọn khu vực bạn chuẩn bị gửi danh sách.</p>
          </div>
          <div className="custom-grid">
            {customs.map((custom, index) => (
              <button
                className="custom-card"
                key={custom}
                onClick={() => selectCustom(custom)}
              >
                <span className="custom-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{custom}</strong>
                <span>Nhập danh sách →</span>
              </button>
            ))}
          </div>
          <NoticeBox notice={homeNotice} />
        </section>
      )}

      {view === "team" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">BƯỚC 2</span>
              <h2>Thông tin custom {selectedCustom}</h2>
            </div>
            <button className="text-button" onClick={() => setView("home")}>
              ← Chọn custom khác
            </button>
          </div>

          <div className="field-block">
            <label htmlFor="team-name">Tên team</label>
            <input
              id="team-name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Ví dụ: STY"
              autoComplete="off"
            />
            <p className="field-hint">
              PlayerNation sẽ lấy đúng tên này, không tự động viết hoa.
            </p>
          </div>

          <div className="member-title-row">
            <div>
              <label>Thành viên team</label>
              <p className="field-hint">
                Tên xuất ra được tạo tự động theo team và tên game của từng
                người. Ví dụ: STY + Tran Thinh → STY.TranThinh.
              </p>
            </div>
            <button
              className="button small ghost"
              onClick={() => setMembers((current) => [...current, blankMember()])}
            >
              + Thêm thành viên
            </button>
          </div>

          <div className="member-list">
            {members.map((member, index) => (
              <div className="member-row" key={member.key}>
                <span className="row-number">{index + 1}</span>
                <div>
                  <label htmlFor={`id-${member.key}`}>ID game</label>
                  <input
                    id={`id-${member.key}`}
                    inputMode="numeric"
                    value={member.playerId}
                    onChange={(event) =>
                      updateMember(
                        member.key,
                        "playerId",
                        event.target.value.replace(/\D/g, ""),
                      )
                    }
                    placeholder="2120337637"
                  />
                </div>
                <div>
                  <label htmlFor={`name-${member.key}`}>Tên game</label>
                  <input
                    id={`name-${member.key}`}
                    value={member.ingame}
                    onChange={(event) =>
                      updateMember(member.key, "ingame", event.target.value)
                    }
                    placeholder="Tran Thinh"
                  />
                  {teamName.trim() && member.ingame.trim() && (
                    <span className="name-preview">
                      Xuất ra: {formatPlayerName(teamName, member.ingame)}
                    </span>
                  )}
                </div>
                <button
                  className="remove-button"
                  aria-label={`Xóa thành viên ${index + 1}`}
                  onClick={() =>
                    setMembers((current) =>
                      current.filter((item) => item.key !== member.key),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="quick-entry">
            <div className="quick-copy">
              <div>
                <span className="section-kicker">NHẬP NHANH</span>
                <h3>Tên team, ID và tên game</h3>
              </div>
              <div className="example-chip">ID + tên game</div>
            </div>
            <p className="field-hint">
              Nhận dạng: ID INGAME, INGAME ID, ID-INGAME, INGAME-ID,
              ID.INGAME, INGAME.ID. Mã màu chỉ ADMIN được chỉnh. Web giữ nguyên
              chữ hoa/thường mà người tham gia nhập.
            </p>
            <textarea
              value={quickInput}
              onChange={(event) => setQuickInput(event.target.value)}
              spellCheck={false}
              placeholder={
                "STY\n2120337637 Tran Thinh\n6598757580 Mai Anh\n1897983397 Bao Nguyen"
              }
            />
            <button className="button ghost" onClick={readQuickInput}>
              Đọc ô nhập nhanh
            </button>
          </div>

          <div className="form-actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => void submitTeam(false)}
            >
              {busy ? "Đang gửi..." : "Gửi về ADMIN"}
            </button>
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => void submitTeam(true)}
            >
              Cập nhật thông tin
            </button>
          </div>
          <NoticeBox notice={teamNotice} />
        </section>
      )}

      {view === "admin" && (
        <AdminPanel
          onBack={() => setView("home")}
          onCustomsChanged={() => void loadCustoms()}
        />
      )}

      <footer>
        <span>CODE NAME MANAGER</span>
        <span>Dữ liệu giữ nguyên cách viết bạn đã nhập.</span>
      </footer>
    </main>
  );
}

function AdminPanel({
  onBack,
  onCustomsChanged,
}: {
  onBack: () => void;
  onCustomsChanged: () => void;
}) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>({
    message: "Nhập mật khẩu ADMIN để tiếp tục.",
    tone: "info",
  });
  const [customs, setCustoms] = useState<AdminCustom[]>([]);
  const [newCustom, setNewCustom] = useState("");
  const [selected, setSelected] = useState("");
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkPreview, setBulkPreview] = useState<BulkTeam[]>([]);

  const loadAdminCustoms = useCallback(async () => {
    const data = await api<{ customs: AdminCustom[] }>("/api/admin/customs");
    setCustoms(data.customs);
  }, []);

  useEffect(() => {
    void api<{ ok: true }>("/api/admin/me")
      .then(async () => {
        setLoggedIn(true);
        await loadAdminCustoms();
      })
      .catch(() => setLoggedIn(false));
  }, [loadAdminCustoms]);

  const login = async () => {
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setLoggedIn(true);
      setNotice({ message: "Đăng nhập thành công.", tone: "ok" });
      await loadAdminCustoms();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không thể đăng nhập.",
        tone: "error",
      });
    }
  };

  const loadSubmissions = async (code: string) => {
    try {
      const data = await api<{ submissions: AdminSubmission[] }>(
        `/api/admin/customs/${encodeURIComponent(code)}/submissions`,
      );
      setSelected(code);
      setSubmissions(data.submissions);
      setNotice({
        message: `Đang xem ${data.submissions.length} team trong ${code}.`,
        tone: "ok",
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không tải được team.",
        tone: "error",
      });
    }
  };

  const addCustom = async () => {
    try {
      const clean = normalizeVisibleText(newCustom);
      await api("/api/admin/customs", {
        method: "POST",
        body: JSON.stringify({ code: clean }),
      });
      setNewCustom("");
      await loadAdminCustoms();
      onCustomsChanged();
      setNotice({ message: `Đã thêm custom ${clean}.`, tone: "ok" });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không thể thêm custom.",
        tone: "error",
      });
    }
  };

  const removeCustom = async (code: string) => {
    if (!window.confirm(`Xóa custom ${code} và toàn bộ team bên trong?`)) return;
    try {
      await api(`/api/admin/customs/${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
      if (selected === code) {
        setSelected("");
        setSubmissions([]);
      }
      await loadAdminCustoms();
      onCustomsChanged();
      setNotice({ message: `Đã xóa custom ${code}.`, tone: "ok" });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không thể xóa.",
        tone: "error",
      });
    }
  };

  const saveColor = async (submission: AdminSubmission, color: string) => {
    try {
      await api(`/api/admin/submissions/${submission.id}`, {
        method: "PUT",
        body: JSON.stringify({ color }),
      });
      await loadSubmissions(selected);
      setNotice({
        message: `Đã lưu màu cho team ${submission.teamName}.`,
        tone: "ok",
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không lưu được màu.",
        tone: "error",
      });
    }
  };

  const parseBulk = () => {
    const lines = bulkInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const teams = new Map<string, BulkTeam["members"]>();
    let currentTeam = "";
    for (const line of lines) {
      const idMatch = line.match(/\d{5,}/);
      if (!idMatch) {
        currentTeam = normalizeVisibleText(line);
        if (!teams.has(currentTeam)) teams.set(currentTeam, []);
        continue;
      }
      if (!currentTeam) {
        throw new Error("Hãy đặt một dòng tên team trước danh sách ID.");
      }
      const before = line.slice(0, idMatch.index).trim();
      const after = line.slice((idMatch.index ?? 0) + idMatch[0].length).trim();
      const ingame = normalizeVisibleText(`${before} ${after}`);
      if (!ingame) throw new Error(`Thiếu tên game ở dòng: ${line}`);
      teams.get(currentTeam)?.push({ playerId: idMatch[0], ingame });
    }
    const preview = Array.from(teams.entries())
      .filter(([, teamMembers]) => teamMembers.length)
      .map(([team, teamMembers]) => ({
        teamName: team,
        color: "#000000",
        members: teamMembers,
      }));
    if (!preview.length) throw new Error("Chưa đọc được team nào.");
    setBulkPreview(preview);
    setNotice({
      message: `Đã đọc ${preview.length} team. Hãy kiểm tra rồi bấm Nạp nhiều team.`,
      tone: "ok",
    });
    return preview;
  };

  const importBulk = async () => {
    try {
      if (!selected) throw new Error("Hãy chọn custom trước.");
      const preview = bulkPreview.length ? bulkPreview : parseBulk();
      await api(
        `/api/admin/customs/${encodeURIComponent(selected)}/submissions`,
        {
          method: "POST",
          body: JSON.stringify({ submissions: preview }),
        },
      );
      setBulkPreview([]);
      await loadSubmissions(selected);
      await loadAdminCustoms();
      setNotice({
        message: `Đã nạp ${preview.length} team vào ${selected}.`,
        tone: "ok",
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không thể nạp dữ liệu.",
        tone: "error",
      });
    }
  };

  const clearSelected = async () => {
    if (!selected) return;
    if (!window.confirm(`Xóa toàn bộ team trong custom ${selected}?`)) return;
    try {
      const data = await api<{ deleted: number }>(
        `/api/admin/customs/${encodeURIComponent(selected)}/submissions`,
        { method: "DELETE" },
      );
      setSubmissions([]);
      await loadAdminCustoms();
      setNotice({
        message: `Đã xóa ${data.deleted} team trong ${selected}.`,
        tone: "ok",
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không thể xóa dữ liệu.",
        tone: "error",
      });
    }
  };

  if (!loggedIn) {
    return (
      <section className="panel login-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">KHU VỰC RIÊNG</span>
            <h2>Đăng nhập ADMIN</h2>
          </div>
          <button className="text-button" onClick={onBack}>
            ← Quay lại
          </button>
        </div>
        <div className="field-block">
          <label htmlFor="admin-password">Mật khẩu ADMIN</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void login();
            }}
            placeholder="Nhập mật khẩu"
          />
        </div>
        <button className="button" onClick={() => void login()}>
          Đăng nhập
        </button>
        <NoticeBox notice={notice} />
      </section>
    );
  }

  return (
    <section className="admin-layout">
      <div className="panel admin-sidebar">
        <div className="section-heading compact">
          <div>
            <span className="section-kicker">ADMIN</span>
            <h2>Danh sách custom</h2>
          </div>
        </div>
        <div className="inline-form">
          <input
            value={newCustom}
            onChange={(event) => setNewCustom(event.target.value)}
            placeholder="Tên custom mới"
          />
          <button className="button small" onClick={() => void addCustom()}>
            Thêm
          </button>
        </div>
        <div className="admin-custom-list">
          {customs.map((custom) => (
            <div
              className={`admin-custom ${selected === custom.code ? "active" : ""}`}
              key={custom.code}
            >
              <button onClick={() => void loadSubmissions(custom.code)}>
                <strong>{custom.code}</strong>
                <span>
                  {custom.team_count} team · {custom.player_count} người
                </span>
              </button>
              <button
                className="icon-danger"
                onClick={() => void removeCustom(custom.code)}
                aria-label={`Xóa ${custom.code}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button className="button ghost small" onClick={onBack}>
            Trang chủ
          </button>
          <button
            className="button ghost small"
            onClick={async () => {
              await api("/api/admin/logout", { method: "POST" });
              setLoggedIn(false);
              setPassword("");
            }}
          >
            Đăng xuất
          </button>
        </div>
        <NoticeBox notice={notice} />
      </div>

      <div className="panel admin-content">
        <div className="section-heading">
          <div>
            <span className="section-kicker">DỮ LIỆU</span>
            <h2>{selected ? `Team trong ${selected}` : "Chọn một custom"}</h2>
          </div>
          {selected && (
            <div className="admin-heading-actions">
              <a
                className="button small ghost"
                href={`/api/admin/customs/${encodeURIComponent(selected)}/preview`}
                target="_blank"
                rel="noreferrer"
              >
                Xem PlayerNameOverwrite
              </a>
              <a
                className="button small"
                href={`/api/admin/customs/${encodeURIComponent(selected)}/export`}
              >
                Tải JSON
              </a>
              <button
                className="button small danger"
                onClick={() => void clearSelected()}
              >
                Xóa dữ liệu
              </button>
            </div>
          )}
        </div>

          {selected && (
            <>
            <p className="export-note">
              File tải về sẽ đặt TeamRegion mặc định là{" "}
              <strong>
                {formatTeamRegion(selected)}
              </strong>
              .
            </p>
            <div className="quick-entry admin-bulk">
              <div className="quick-copy">
                <div>
                  <span className="section-kicker">NHẬP NHIỀU TEAM</span>
                  <h3>Danh sách giải</h3>
                </div>
                <div className="example-chip">Tên team → ID + tên</div>
              </div>
              <textarea
                value={bulkInput}
                onChange={(event) => setBulkInput(event.target.value)}
                spellCheck={false}
                placeholder={
                  "STY\n2120337637 Tran Thinh\n6598757580 Mai Anh\n\nTeam Hai\n1897983397 Bao Nguyen"
                }
              />
              <div className="form-actions">
                <button
                  className="button ghost small"
                  onClick={() => {
                    try {
                      parseBulk();
                    } catch (error) {
                      setNotice({
                        message:
                          error instanceof Error
                            ? error.message
                            : "Không đọc được danh sách.",
                        tone: "error",
                      });
                    }
                  }}
                >
                  Xem trước
                </button>
                <button
                  className="button small"
                  onClick={() => void importBulk()}
                >
                  Nạp nhiều team
                </button>
              </div>
              {bulkPreview.length > 0 && (
                <div className="bulk-preview">
                  {bulkPreview.map((team) => (
                    <div key={team.teamName}>
                      <strong>{team.teamName}</strong>
                      <span>
                        {team.members
                          .map(
                            (member) =>
                              `${member.playerId} ${formatPlayerName(team.teamName, member.ingame)}`,
                          )
                          .join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="submission-list">
              {submissions.length === 0 && (
                <div className="empty-state">
                  Custom này chưa có team gửi về.
                </div>
              )}
              {submissions.map((submission) => (
                <AdminTeamCard
                  key={submission.id}
                  submission={submission}
                  onSaveColor={saveColor}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function AdminTeamCard({
  submission,
  onSaveColor,
}: {
  submission: AdminSubmission;
  onSaveColor: (submission: AdminSubmission, color: string) => Promise<void>;
}) {
  const [color, setColor] = useState(submission.color);
  return (
    <article className="team-card">
      <div className="team-card-heading">
        <div>
          <span>PLAYER NATION</span>
          <h3>{submission.teamName}</h3>
        </div>
        <div className="color-control">
          <input
            type="color"
            value={/^#[0-9A-F]{6}$/i.test(color) ? color : "#000000"}
            onChange={(event) => setColor(event.target.value)}
          />
          <button
            className="text-button"
            onClick={() => void onSaveColor(submission, color)}
          >
            Lưu màu
          </button>
        </div>
      </div>
      <div className="admin-member-table">
        {submission.members.map((member) => (
          <div key={member.id}>
            <code>{member.playerId}</code>
            <span>{member.playerName}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

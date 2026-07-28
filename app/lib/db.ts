import type { Pool, PoolClient } from "pg";
import {
  formatPlayerName,
  formatTeamRegion,
  normalizeVisibleText,
} from "./names";

type D1Result<T> = { results?: T[] };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};
type D1DatabaseLike = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
};
type RuntimeBindings = {
  DB?: D1DatabaseLike;
  ADMIN_PASSWORD?: string;
};
type SqlStatement = { sql: string; values?: unknown[] };

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

type CustomRow = {
  code: string;
  color: string;
  team_count: number | string;
  player_count: number | string;
};

type SubmissionRow = {
  id: string;
  custom_code: string;
  team_name: string;
  color: string;
  edit_token: string;
  created_at: string;
};

type MemberRow = {
  id: number;
  submission_id: string;
  player_id: string;
  ingame: string;
  player_name: string;
};

export type SubmissionInput = {
  teamName: string;
  color?: string;
  members: Array<{ playerId: string; ingame: string }>;
};

function databaseUrl(): string {
  return typeof process !== "undefined"
    ? String(process.env.DATABASE_URL || "")
    : "";
}

async function getPool(): Promise<Pool> {
  if (pool) return pool;
  const url = databaseUrl();
  if (!url) throw new Error("PostgreSQL chưa được kết nối.");
  const { Pool: PgPool } = await import("pg");
  pool = new PgPool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

function getD1(): D1DatabaseLike {
  const runtime = globalThis as typeof globalThis & {
    __FF_RUNTIME_ENV?: RuntimeBindings;
  };
  const db = runtime.__FF_RUNTIME_ENV?.DB;
  if (!db) {
    throw new Error("Cơ sở dữ liệu chưa được kết nối.");
  }
  return db;
}

function usesPostgres(): boolean {
  return Boolean(databaseUrl());
}

function postgresSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function all<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  if (usesPostgres()) {
    const result = await (await getPool()).query<T>(postgresSql(sql), values);
    return result.rows;
  }
  const result = await getD1().prepare(sql).bind(...values).all<T>();
  return result.results ?? [];
}

async function first<T>(
  sql: string,
  values: unknown[] = [],
): Promise<T | null> {
  if (usesPostgres()) {
    const rows = await all<T>(sql, values);
    return rows[0] ?? null;
  }
  return getD1().prepare(sql).bind(...values).first<T>();
}

async function run(sql: string, values: unknown[] = []): Promise<void> {
  if (usesPostgres()) {
    await (await getPool()).query(postgresSql(sql), values);
    return;
  }
  await getD1().prepare(sql).bind(...values).run();
}

async function postgresTransaction(
  client: PoolClient,
  statements: SqlStatement[],
): Promise<void> {
  await client.query("BEGIN");
  try {
    for (const statement of statements) {
      await client.query(
        postgresSql(statement.sql),
        statement.values ?? [],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function batch(statements: SqlStatement[]): Promise<void> {
  if (usesPostgres()) {
    const client = await (await getPool()).connect();
    try {
      await postgresTransaction(client, statements);
    } finally {
      client.release();
    }
    return;
  }
  const db = getD1();
  await db.batch(
    statements.map((statement) =>
      db.prepare(statement.sql).bind(...(statement.values ?? [])),
    ),
  );
}

async function createSchema(): Promise<void> {
  if (usesPostgres()) {
    await batch([
      {
        sql: `CREATE TABLE IF NOT EXISTS customs (
          code TEXT PRIMARY KEY,
          color TEXT NOT NULL DEFAULT '#000000',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS submissions (
          id TEXT PRIMARY KEY,
          custom_code TEXT NOT NULL REFERENCES customs(code) ON DELETE CASCADE,
          team_name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#000000',
          edit_token TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS members (
          id BIGSERIAL PRIMARY KEY,
          submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
          player_id TEXT NOT NULL,
          ingame TEXT NOT NULL,
          player_name TEXT NOT NULL
        )`,
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS idx_submissions_custom ON submissions(custom_code)",
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS idx_members_submission ON members(submission_id)",
      },
      {
        sql: "INSERT INTO customs (code, color) VALUES ('MP', '#000000') ON CONFLICT (code) DO NOTHING",
      },
      {
        sql: "INSERT INTO customs (code, color) VALUES ('XN', '#000000') ON CONFLICT (code) DO NOTHING",
      },
      {
        sql: "INSERT INTO customs (code, color) VALUES ('HV', '#000000') ON CONFLICT (code) DO NOTHING",
      },
    ]);
    return;
  }

  await batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS customs (
        code TEXT PRIMARY KEY COLLATE BINARY,
        color TEXT NOT NULL DEFAULT '#000000',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        custom_code TEXT NOT NULL,
        team_name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#000000',
        edit_token TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        ingame TEXT NOT NULL,
        player_name TEXT NOT NULL
      )`,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_submissions_custom ON submissions(custom_code)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_members_submission ON members(submission_id)",
    },
    {
      sql: "INSERT OR IGNORE INTO customs (code, color) VALUES ('MP', '#000000')",
    },
    {
      sql: "INSERT OR IGNORE INTO customs (code, color) VALUES ('XN', '#000000')",
    },
    {
      sql: "INSERT OR IGNORE INTO customs (code, color) VALUES ('HV', '#000000')",
    },
  ]);
}

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = createSchema();
  try {
    await schemaReady;
  } catch (error) {
    schemaReady = null;
    throw error;
  }
}

export function normalizeColor(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toUpperCase() : "#000000";
}

export function validateSubmission(input: SubmissionInput): SubmissionInput {
  const teamName = normalizeVisibleText(input.teamName);
  if (!teamName) throw new Error("Hãy nhập tên team.");
  if (teamName.length > 40) throw new Error("Tên team tối đa 40 ký tự.");

  const members = (Array.isArray(input.members) ? input.members : [])
    .map((member) => ({
      playerId: String(member.playerId ?? "").trim(),
      ingame: normalizeVisibleText(member.ingame),
    }))
    .filter((member) => member.playerId || member.ingame);

  if (!members.length) throw new Error("Hãy nhập ít nhất 1 thành viên.");
  if (members.length > 15) throw new Error("Mỗi team tối đa 15 thành viên.");

  const seen = new Set<string>();
  for (const [index, member] of members.entries()) {
    if (!/^\d{5,20}$/.test(member.playerId)) {
      throw new Error(`ID ở dòng ${index + 1} không hợp lệ.`);
    }
    if (!member.ingame) {
      throw new Error(`Thiếu tên game ở dòng ${index + 1}.`);
    }
    if (seen.has(member.playerId)) {
      throw new Error(`ID ${member.playerId} bị trùng.`);
    }
    seen.add(member.playerId);
  }

  return {
    teamName,
    color: normalizeColor(input.color),
    members,
  };
}

export async function listCustoms() {
  await ensureSchema();
  const rows = await all<CustomRow>(`
    SELECT
      c.code,
      c.color,
      COUNT(DISTINCT s.id) AS team_count,
      COUNT(m.id) AS player_count
    FROM customs c
    LEFT JOIN submissions s ON s.custom_code = c.code
    LEFT JOIN members m ON m.submission_id = s.id
    GROUP BY c.code, c.color, c.created_at
    ORDER BY c.created_at ASC, c.code ASC
  `);
  return rows.map((row) => ({
    ...row,
    team_count: Number(row.team_count),
    player_count: Number(row.player_count),
  }));
}

export async function addCustom(codeValue: unknown): Promise<string> {
  const code = normalizeVisibleText(codeValue);
  if (!code) throw new Error("Hãy nhập tên custom.");
  if (code.length > 60) throw new Error("Tên custom tối đa 60 ký tự.");
  await ensureSchema();
  if (usesPostgres()) {
    await run(
      "INSERT INTO customs (code, color) VALUES (?, '#000000') ON CONFLICT (code) DO NOTHING",
      [code],
    );
  } else {
    await run(
      "INSERT OR IGNORE INTO customs (code, color) VALUES (?, '#000000')",
      [code],
    );
  }
  return code;
}

export async function deleteCustom(code: string): Promise<void> {
  await ensureSchema();
  if (usesPostgres()) {
    await run("DELETE FROM customs WHERE code = ?", [code]);
    return;
  }
  const ids = await all<{ id: string }>(
    "SELECT id FROM submissions WHERE custom_code = ?",
    [code],
  );
  await batch([
    ...ids.map((row) => ({
      sql: "DELETE FROM members WHERE submission_id = ?",
      values: [row.id],
    })),
    { sql: "DELETE FROM submissions WHERE custom_code = ?", values: [code] },
    { sql: "DELETE FROM customs WHERE code = ?", values: [code] },
  ]);
}

export async function createSubmission(
  customCode: string,
  input: SubmissionInput,
): Promise<{ id: string; editToken: string; teamName: string }> {
  const custom = normalizeVisibleText(customCode);
  const clean = validateSubmission(input);
  await ensureSchema();
  const exists = await first<{ code: string }>(
    "SELECT code FROM customs WHERE code = ?",
    [custom],
  );
  if (!exists) throw new Error("Custom không tồn tại.");

  const id = crypto.randomUUID();
  const editToken = crypto.randomUUID();
  await batch([
    {
      sql: "INSERT INTO submissions (id, custom_code, team_name, color, edit_token) VALUES (?, ?, ?, ?, ?)",
      values: [id, custom, clean.teamName, clean.color, editToken],
    },
    ...clean.members.map((member) => ({
      sql: "INSERT INTO members (submission_id, player_id, ingame, player_name) VALUES (?, ?, ?, ?)",
      values: [
        id,
        member.playerId,
        member.ingame,
        formatPlayerName(clean.teamName, member.ingame),
      ],
    })),
  ]);
  return { id, editToken, teamName: clean.teamName };
}

export async function updateSubmission(
  id: string,
  editToken: string,
  input: SubmissionInput,
): Promise<{ teamName: string }> {
  const clean = validateSubmission(input);
  await ensureSchema();
  const current = await first<{ id: string }>(
    "SELECT id FROM submissions WHERE id = ? AND edit_token = ?",
    [id, editToken],
  );
  if (!current) throw new Error("Không tìm thấy phiếu chỉnh sửa hợp lệ.");

  await batch([
    {
      sql: "UPDATE submissions SET team_name = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      values: [clean.teamName, clean.color, id],
    },
    { sql: "DELETE FROM members WHERE submission_id = ?", values: [id] },
    ...clean.members.map((member) => ({
      sql: "INSERT INTO members (submission_id, player_id, ingame, player_name) VALUES (?, ?, ?, ?)",
      values: [
        id,
        member.playerId,
        member.ingame,
        formatPlayerName(clean.teamName, member.ingame),
      ],
    })),
  ]);
  return { teamName: clean.teamName };
}

export async function listSubmissions(customCode: string) {
  await ensureSchema();
  const submissions = await all<SubmissionRow>(
    "SELECT * FROM submissions WHERE custom_code = ? ORDER BY created_at ASC",
    [customCode],
  );
  if (!submissions.length) return [];

  const members = await all<MemberRow>(
    `SELECT m.* FROM members m
     INNER JOIN submissions s ON s.id = m.submission_id
     WHERE s.custom_code = ?
     ORDER BY m.id ASC`,
    [customCode],
  );

  return submissions.map((submission) => ({
    id: submission.id,
    customCode: submission.custom_code,
    teamName: submission.team_name,
    color: submission.color,
    createdAt: submission.created_at,
    members: members
      .filter((member) => member.submission_id === submission.id)
      .map((member) => ({
        id: Number(member.id),
        playerId: member.player_id,
        ingame: member.ingame,
        playerName: member.player_name,
      })),
  }));
}

export async function setSubmissionColor(
  id: string,
  colorValue: unknown,
): Promise<string> {
  const color = normalizeColor(colorValue);
  await ensureSchema();
  await run(
    "UPDATE submissions SET color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [color, id],
  );
  return color;
}

export async function clearCustomSubmissions(code: string): Promise<number> {
  await ensureSchema();
  const ids = await all<{ id: string }>(
    "SELECT id FROM submissions WHERE custom_code = ?",
    [code],
  );
  if (!ids.length) return 0;
  if (usesPostgres()) {
    await run("DELETE FROM submissions WHERE custom_code = ?", [code]);
  } else {
    await batch([
      ...ids.map((row) => ({
        sql: "DELETE FROM members WHERE submission_id = ?",
        values: [row.id],
      })),
      {
        sql: "DELETE FROM submissions WHERE custom_code = ?",
        values: [code],
      },
    ]);
  }
  return ids.length;
}

export async function exportCustom(code: string) {
  const submissions = await listSubmissions(code);
  return {
    PlayerNameList: submissions.flatMap((submission) =>
      submission.members.map((member) => ({
        PlayerID: Number(member.playerId),
        PlayerNameOverwrite: member.playerName,
        PlayerNation: submission.teamName,
        Color: submission.color,
      })),
    ),
    TeamRegionList: Array.from({ length: 15 }, (_, index) => ({
      TeamID: index + 1,
      TeamRegion: formatTeamRegion(code),
      Color: "#000000",
    })),
  };
}

export type ParsedMember = {
  playerId: string;
  ingame: string;
};

export function normalizeVisibleText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function compactPlayerName(value: unknown): string {
  return normalizeVisibleText(value).replace(/\s+/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatPlayerName(teamValue: unknown, ingameValue: unknown): string {
  const teamName = normalizeVisibleText(teamValue);
  const rawName = normalizeVisibleText(ingameValue);
  if (!teamName || !rawName) return "";

  const existingPrefix = new RegExp(
    `^${escapeRegExp(teamName)}[._\\-\\s]+`,
    "i",
  );
  const playerOnly = rawName.replace(existingPrefix, "");
  const compact = compactPlayerName(playerOnly || rawName);

  return compact ? `${teamName}.${compact}` : "";
}

export function formatTeamRegion(customValue: unknown): string {
  const customName =
    normalizeVisibleText(customValue).replace(/^custom\s*/i, "").toUpperCase() ||
    "CUSTOM";
  return `SCRIM ${customName}`;
}

export function parseQuickInput(value: unknown): {
  teamName: string;
  members: ParsedMember[];
} {
  const lines = String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let teamName = "";
  const members: ParsedMember[] = [];

  for (const line of lines) {
    const idMatch = line.match(/\d{5,}/);
    if (!idMatch) {
      if (!teamName) {
        teamName = normalizeVisibleText(
          line.replace(/^(team|tên team|ten team)\s*[:：-]\s*/i, ""),
        );
      }
      continue;
    }

    const before = line.slice(0, idMatch.index).trim();
    const after = line.slice((idMatch.index ?? 0) + idMatch[0].length).trim();
    const ingame = normalizeVisibleText(`${before} ${after}`)
      .replace(/^[,;:|./_\-\s]+|[,;:|./_\-\s]+$/g, "")
      .trim();

    if (ingame) {
      members.push({ playerId: idMatch[0], ingame });
    }
  }

  return { teamName, members };
}

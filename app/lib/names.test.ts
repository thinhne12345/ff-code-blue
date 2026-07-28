import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPlayerName,
  formatTeamRegion,
  normalizeVisibleText,
  parseQuickInput,
} from "./names.ts";

test("keeps team and player letter casing", () => {
  assert.equal(formatPlayerName("STY", "Tran Thinh"), "STY.TranThinh");
  assert.equal(formatPlayerName("sTy", "Trần thịnh"), "sTy.Trầnthịnh");
});

test("does not duplicate an existing team prefix", () => {
  assert.equal(formatPlayerName("STY", "STY.TranThinh"), "STY.TranThinh");
  assert.equal(formatPlayerName("STY", "sty_Tran Thinh"), "STY.TranThinh");
});

test("quick input keeps the typed casing", () => {
  assert.deepEqual(
    parseQuickInput("STY\n2120337637 Tran Thinh\nMaiAnh 6598757580"),
    {
      teamName: "STY",
      members: [
        { playerId: "2120337637", ingame: "Tran Thinh" },
        { playerId: "6598757580", ingame: "MaiAnh" },
      ],
    },
  );
});

test("quick input accepts every supported ID and ingame order", () => {
  const styles = [
    "2120337637 Tran Thinh",
    "Tran Thinh 2120337637",
    "2120337637-Tran Thinh",
    "Tran Thinh-2120337637",
    "2120337637.Tran Thinh",
    "Tran Thinh.2120337637",
  ];
  for (const line of styles) {
    assert.deepEqual(parseQuickInput(`ABC\n${line}`).members, [
      { playerId: "2120337637", ingame: "Tran Thinh" },
    ]);
  }
});

test("normalization only tidies whitespace", () => {
  assert.equal(normalizeVisibleText("  Team  Nhỏ  "), "Team Nhỏ");
});

test("TeamRegion defaults to SCRIM plus the custom name", () => {
  assert.equal(formatTeamRegion("Custom At"), "SCRIM AT");
  assert.equal(formatTeamRegion("MP"), "SCRIM MP");
});

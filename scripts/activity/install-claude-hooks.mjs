#!/usr/bin/env node
// Installs the MyTrack activity hook in ~/.claude/settings.json (idempotent, keeps everything else).
// Usage: node scripts/activity/install-claude-hooks.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, chmodSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const configDir = join(homedir(), ".config", "mytrack");
const installed = join(configDir, "claude-hook.sh");
const settingsPath = join(homedir(), ".claude", "settings.json");

mkdirSync(configDir, { recursive: true });
copyFileSync(join(here, "claude-hook.sh"), installed);
chmodSync(installed, 0o755);

const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
settings.hooks ??= {};

const EVENTS = ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"];
for (const event of EVENTS) {
  const groups = (settings.hooks[event] ??= []);
  const already = groups.some((g) => (g.hooks || []).some((h) => h.command === installed));
  if (!already) groups.push({ hooks: [{ type: "command", command: installed }] });
}

writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
console.log(`Hook installed: ${installed}`);
console.log(`Settings updated: ${settingsPath}`);
if (!existsSync(join(configDir, "activity.json"))) {
  console.log(`\nNext: MyTrack > Profil > Suivi automatique > "Copier la config", then save it to ${join(configDir, "activity.json")}`);
}

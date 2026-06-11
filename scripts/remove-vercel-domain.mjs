import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const sep = t.indexOf("=");
  if (sep < 0) continue;
  const k = t.slice(0, sep).trim();
  const v = t.slice(sep + 1).trim().replace(/^['"]|['"]$/g, "");
  if (!process.env[k]) process.env[k] = v;
}

const domain = process.argv[2]?.trim().toLowerCase();
if (!domain) {
  console.error("Usage: node scripts/remove-vercel-domain.mjs <domain>");
  process.exitCode = 1;
  process.exit();
}

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID;

if (!token || !projectId) {
  console.error("VERCEL_TOKEN and VERCEL_PROJECT_ID are required in .env.local");
  process.exitCode = 1;
  process.exit();
}

const base = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`;
const url = new URL(base);
if (teamId) url.searchParams.set("teamId", teamId);

console.log(`Removing "${domain}" from Vercel project ${projectId}...`);

const res = await fetch(url, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
});

if (res.status === 404) {
  console.log(`"${domain}" was not found on Vercel. Nothing to remove.`);
} else if (res.ok) {
  console.log(`"${domain}" successfully removed from Vercel.`);
  console.log("You can now add it to a new lab via the Domains page.");
} else {
  const data = await res.json().catch(() => ({}));
  console.error(`Vercel returned ${res.status}:`, data.error?.message || JSON.stringify(data));
  process.exitCode = 1;
}

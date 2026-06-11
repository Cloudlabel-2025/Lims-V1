import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import { getLabModel } from "../src/app/models/master/Lab.js";

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

const uri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
const Lab = getLabModel(conn);
const domain = process.argv[2]?.trim().toLowerCase();

if (!domain) {
  console.error("Usage: node scripts/check-embedded-domain.mjs <domain>");
  process.exitCode = 1;
  await conn.close();
  process.exit();
}

const embedded = await Lab.findOne({ "customDomains.domainName": domain })
  .select("name tenantId status customDomains")
  .lean();

if (embedded) {
  console.log(`Found embedded in lab: ${embedded.name} (${embedded.tenantId}) status=${embedded.status}`);
  await Lab.updateOne(
    { _id: embedded._id },
    { $pull: { customDomains: { domainName: domain } } }
  );
  console.log(`Removed from embedded customDomains. ${domain} is fully released.`);
} else {
  console.log(`${domain} is NOT in any lab embedded customDomains. Fully clean.`);
}

await conn.close();

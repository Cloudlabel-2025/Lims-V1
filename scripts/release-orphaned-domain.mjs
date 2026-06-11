/**
 * release-orphaned-domain.mjs
 *
 * Removes a domain that is stuck in the TenantDomain collection
 * because its parent lab was hard-deleted.
 *
 * Usage:
 *   node scripts/release-orphaned-domain.mjs uthiram.in
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import { getTenantDomainModel } from "../src/app/models/master/TenantDomain.js";
import { getLabModel } from "../src/app/models/master/Lab.js";

const rootDir = process.cwd();

function loadLocalEnv() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();

  const domain = process.argv[2]?.trim().toLowerCase();
  if (!domain) {
    console.error("Usage: node scripts/release-orphaned-domain.mjs <domain>");
    console.error("Example: node scripts/release-orphaned-domain.mjs uthiram.in");
    process.exitCode = 1;
    return;
  }

  const masterUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
  if (!masterUri) {
    throw new Error("MASTER_MONGODB_URI or MONGODB_URI is required in .env.local");
  }

  const connection = await mongoose
    .createConnection(masterUri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();

  const TenantDomain = getTenantDomainModel(connection);
  const Lab = getLabModel(connection);

  // 1. Find the domain record
  const domainRecord = await TenantDomain.findOne({ domain }).lean();
  if (!domainRecord) {
    console.log(`Domain "${domain}" was not found in TenantDomain collection.`);
    console.log("It may already be released or was never registered here.");
    await connection.close();
    return;
  }

  console.log(`Found domain record:`);
  console.log(`  domain    : ${domainRecord.domain}`);
  console.log(`  tenantId  : ${domainRecord.tenantId}`);
  console.log(`  status    : ${domainRecord.status}`);
  console.log(`  lab ref   : ${domainRecord.lab}`);

  // 2. Check if the parent lab still exists
  const parentLab = await Lab.findById(domainRecord.lab).select("_id tenantId status name").lean();
  if (parentLab) {
    console.log(`\nParent lab still exists:`);
    console.log(`  name     : ${parentLab.name}`);
    console.log(`  tenantId : ${parentLab.tenantId}`);
    console.log(`  status   : ${parentLab.status}`);
    console.log("\nThis domain is NOT orphaned - it belongs to an existing lab.");
    console.log(`To remove it, use the Domains page in the developer UI instead.`);
    await connection.close();
    return;
  }

  // 3. Also check the embedded customDomains array on any lab
  const embeddedOwner = await Lab.findOne({ "customDomains.domainName": domain })
    .select("_id tenantId name")
    .lean();

  if (embeddedOwner) {
    console.log(`\nDomain is also embedded in lab "${embeddedOwner.name}" (${embeddedOwner.tenantId}).`);
    console.log("Removing from embedded customDomains array...");
    await Lab.updateOne(
      { _id: embeddedOwner._id },
      { $pull: { customDomains: { domainName: domain } } }
    );
    console.log("Removed from embedded array.");
  }

  // 4. Delete the orphaned TenantDomain record
  await TenantDomain.deleteOne({ _id: domainRecord._id });
  console.log(`\nOrphaned domain "${domain}" has been released.`);
  console.log("You can now add this domain to a new lab.");

  await connection.close();
}

main().catch(async (error) => {
  console.error("Script failed:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});

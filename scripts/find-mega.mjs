import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import { getLabModel } from "../src/app/models/master/Lab.js";

const rootDir = process.cwd();

function loadLocalEnv() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}

async function main() {
  loadLocalEnv();

  const masterUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
  if (!masterUri) {
    throw new Error("MASTER_MONGODB_URI or MONGODB_URI is required");
  }

  const masterConnection = await mongoose
    .createConnection(masterUri, {
      dbName: "CMS",
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();

  const Lab = getLabModel(masterConnection);
  const lab = await Lab.findOne({ tenantId: "mega" }).select("+dbConnectionString");
  if (lab) {
    console.log("Lab mega found:", JSON.stringify(lab, null, 2));
  } else {
    console.log("Lab mega NOT found! Creating default active lab for mega...");
    const newLab = await Lab.create({
      name: "Mega Lab",
      tenantId: "mega",
      dbName: "mega",
      dbConnectionString: masterUri, // use same URI locally
      status: "active",
      subscriptionPlan: "professional",
      enabledModules: ["dashboard", "patients", "doctors", "tests", "billing", "samples", "reports", "analytics", "accounts", "inventory"]
    });
    console.log("Lab mega created:", JSON.stringify(newLab, null, 2));
  }
  await masterConnection.close();
}

main().catch(console.error);

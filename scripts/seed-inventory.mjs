import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import { getLabModel } from "../src/app/models/master/Lab.js";
import { seedDefaultInventory } from "../src/app/lib/inventory-seeder.js";

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

  const tenantIdArg = process.env.TENANT_ID || process.argv[2];

  const masterConnection = await mongoose
    .createConnection(masterUri, {
      dbName: "CMS",
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();

  console.log("Connected to master database.");

  const Lab = getLabModel(masterConnection);
  const query = { status: "active" };
  if (tenantIdArg) {
    query.tenantId = tenantIdArg.toLowerCase();
  }

  const labs = await Lab.find(query).select("+dbConnectionString");
  if (labs.length === 0) {
    console.log(tenantIdArg ? `No active lab found for tenant: ${tenantIdArg}` : "No active labs found.");
    await masterConnection.close();
    return;
  }

  console.log(`Found ${labs.length} lab(s) to seed.`);

  for (const lab of labs) {
    console.log(`Seeding inventory for lab: ${lab.name} (${lab.tenantId}) in database: ${lab.dbName}...`);
    
    let tenantConnection = null;
    try {
      tenantConnection = await mongoose
        .createConnection(lab.dbConnectionString, {
          dbName: lab.dbName,
          bufferCommands: false,
          maxPoolSize: 5,
          serverSelectionTimeoutMS: 5000,
        })
        .asPromise();

      const result = await seedDefaultInventory(tenantConnection);
      console.log(`Successfully seeded inventory:`);
      console.log(`  - ${result.uomsSeeded} UOMs`);
      console.log(`  - ${result.categoriesSeeded} Categories`);
      console.log(`  - ${result.suppliersSeeded} Suppliers`);
      console.log(`  - ${result.itemsSeeded} new Items & Batches`);
    } catch (err) {
      console.error(`Failed to connect or seed inventory for lab ${lab.tenantId}:`, err.message);
    } finally {
      if (tenantConnection) {
        await tenantConnection.close();
      }
    }
  }

  await masterConnection.close();
  console.log("Inventory seeding complete.");
}

main().catch((error) => {
  console.error("Inventory seeding failed:", error.message);
  process.exitCode = 1;
});

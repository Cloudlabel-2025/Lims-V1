import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

function loadEnv(path) {
  const content = readFileSync(path, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv(envPath);
const MONGODB_URI = env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI not found in .env.local");
  process.exit(1);
}

const SOURCE_DB = "test";
const TARGET_DB = "CMS";

async function migrate() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB\n");

    const source = client.db(SOURCE_DB);
    const target = client.db(TARGET_DB);

    const collections = await source.listCollections().toArray();

    if (collections.length === 0) {
      console.log(`No collections found in '${SOURCE_DB}' database.`);
      return;
    }

    console.log(`Found ${collections.length} collection(s) in '${SOURCE_DB}':`);
    collections.forEach((c) => console.log(`  - ${c.name}`));
    console.log("");

    for (const col of collections) {
      const name = col.name;
      process.stdout.write(`Migrating '${name}'... `);

      const docs = await source.collection(name).find({}).toArray();

      if (docs.length === 0) {
        console.log("skipped (empty)");
        continue;
      }

      await target.collection(name).deleteMany({});
      await target.collection(name).insertMany(docs);

      console.log(`${docs.length} document(s) copied`);
    }

    console.log("\nMigration complete!");
    console.log(`\nNext steps:`);
    console.log(`1. Add dbName: "CMS" back to src/app/lib/master-db.js`);
    console.log(`2. Add dbName: "CMS" back to src/app/lib/mongodb.js`);
    console.log(`3. Test your app`);
    console.log(`4. Delete old '${SOURCE_DB}' database from MongoDB Atlas`);
  } catch (error) {
    console.error("\nMigration failed:", error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();

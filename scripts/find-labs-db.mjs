import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

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

console.log("Connected to DB:", conn.db.databaseName);

const dbs = await conn.db.admin().listDatabases();
console.log("All databases:", dbs.databases.map(d => d.name).join(", "));

// find labs in each db
for (const db of dbs.databases) {
  if (["admin", "local", "config"].includes(db.name)) continue;
  const dbConn = conn.useDb(db.name);
  const count = await dbConn.collection("labs").countDocuments();
  if (count > 0) console.log(`DB "${db.name}" has ${count} labs`);
}

await conn.close();

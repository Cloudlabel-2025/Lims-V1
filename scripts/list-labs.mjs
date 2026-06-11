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
const labs = await conn.db.collection("labs").find({}, {
  projection: { name: 1, tenantId: 1, status: 1, _id: 1 }
}).toArray();

console.log("All labs:");
for (const lab of labs) {
  console.log(`  _id=${lab._id}  tenantId=${lab.tenantId}  name=${lab.name}  status=${lab.status}`);
}

const marry = labs.find(l => l.tenantId === "marry" || l.name?.toLowerCase().includes("marry"));
console.log("\nmarry lab:", marry ? JSON.stringify(marry) : "NOT FOUND");
await conn.close();

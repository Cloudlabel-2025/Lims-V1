import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import { hashPassword, validatePasswordPolicy } from "../src/app/lib/password.js";
import { getDeveloperUserModel } from "../src/app/models/master/DeveloperUser.js";

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

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function main() {
  loadLocalEnv();

  const masterUri = process.env.MASTER_MONGODB_URI || requiredEnv("MONGODB_URI");
  const email = requiredEnv("DEVELOPER_OWNER_EMAIL").toLowerCase();
  const password = requiredEnv("DEVELOPER_OWNER_PASSWORD");
  const firstName = process.env.DEVELOPER_OWNER_FIRST_NAME?.trim() || "System";
  const lastName = process.env.DEVELOPER_OWNER_LAST_NAME?.trim() || "Owner";
  const passwordPolicy = validatePasswordPolicy(password);

  if (!passwordPolicy.valid) {
    throw new Error(passwordPolicy.errors.join("; "));
  }

  const connection = await mongoose
    .createConnection(masterUri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();

  const DeveloperUser = getDeveloperUserModel(connection);
  const passwordHash = await hashPassword(password);

  const existing = await DeveloperUser.findOne({ singletonKey: "system-owner" }).select(
    "+singletonKey +passwordHash"
  );

  if (existing) {
    existing.set({
      firstName,
      lastName,
      email,
      passwordHash,
      status: "active",
      passwordResetTokenHash: undefined,
      passwordResetExpiresAt: undefined,
    });
    await existing.save();
    console.log(`Developer owner updated: ${email}`);
  } else {
    await DeveloperUser.create({
      singletonKey: "system-owner",
      firstName,
      lastName,
      email,
      passwordHash,
      isSystemOwner: true,
      status: "active",
    });
    console.log(`Developer owner created: ${email}`);
  }

  const extraEmails = (process.env.CMS_DEVELOPER_EMAILS || "balajibm@gmail.com,vidhya@gmail.com")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => item !== email);

  for (const extraEmail of extraEmails) {
    const singletonKey = `cms-${extraEmail}`;
    const existingDeveloper = await DeveloperUser.findOne({ email: extraEmail }).select("+singletonKey +passwordHash");
    const [firstName] = extraEmail.split("@");
    const userData = {
      singletonKey,
      firstName: firstName.slice(0, 60) || "CMS",
      lastName: "Developer",
      email: extraEmail,
      passwordHash,
      isSystemOwner: true,
      status: "active",
      passwordResetTokenHash: undefined,
      passwordResetExpiresAt: undefined,
    };

    if (existingDeveloper) {
      await DeveloperUser.updateOne({ _id: existingDeveloper._id }, { $set: userData });
      console.log(`CMS developer updated: ${extraEmail}`);
    } else {
      await DeveloperUser.create(userData);
      console.log(`CMS developer created: ${extraEmail}`);
    }
  }

  await connection.close();
}

main().catch(async (error) => {
  console.error("Developer owner seed failed:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});

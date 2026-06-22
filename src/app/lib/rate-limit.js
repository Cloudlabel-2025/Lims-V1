import connectMasterDB from "@/app/lib/master-db";
import mongoose from "mongoose";

const RateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

function getRateLimitModel(connection) {
  return connection.models.RateLimit || connection.model("RateLimit", RateLimitSchema);
}

export async function checkRateLimit({ namespace, identifier, maxAttempts = 5, windowMs = 60000 }) {
  const connection = await connectMasterDB();
  const RateLimit = getRateLimitModel(connection);
  const key = `${namespace}:${identifier}`;

  const now = new Date();
  const record = await RateLimit.findOne({ key, expiresAt: { $gt: now } });

  if (record) {
    if (record.count >= maxAttempts) {
      const retryAfter = Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000);
      return { allowed: false, retryAfter, remaining: 0 };
    }

    await RateLimit.updateOne({ key }, { $inc: { count: 1 } });
    return { allowed: true, remaining: maxAttempts - record.count - 1 };
  }

  await RateLimit.updateOne(
    { key },
    { $set: { key, count: 1, expiresAt: new Date(now.getTime() + windowMs) } },
    { upsert: true }
  );

  return { allowed: true, remaining: maxAttempts - 1 };
}

export async function resetRateLimit(namespace, identifier) {
  const connection = await connectMasterDB();
  const RateLimit = getRateLimitModel(connection);
  await RateLimit.deleteOne({ key: `${namespace}:${identifier}` });
}

export function getClientIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

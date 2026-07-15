import mongoose from "mongoose";

const masterDbCache = globalThis.masterDbCache || {
  conn: null,
  promise: null,
};

globalThis.masterDbCache = masterDbCache;

const connectionOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  dbName: "CMS",
};

export async function connectMasterDB() {
  const uri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MASTER_MONGODB_URI or MONGODB_URI is not defined in environment variables");
  }

  if (masterDbCache.conn) {
    return masterDbCache.conn;
  }

  if (!masterDbCache.promise) {
    masterDbCache.promise = mongoose
      .createConnection(uri, connectionOptions)
      .asPromise()
      .catch((error) => {
        masterDbCache.promise = null;
        throw error;
      });
  }

  masterDbCache.conn = await masterDbCache.promise;
  return masterDbCache.conn;
}

export default connectMasterDB;

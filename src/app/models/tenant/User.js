import mongoose from "mongoose";

function getCounterModel(connection) {
  return (
    connection.models.Counter ||
    connection.model(
      "Counter",
      new mongoose.Schema({
        name: { type: String, required: true, unique: true },
        seq: { type: Number, default: 0 },
      })
    )
  );
}

async function getNextSequence(connection, name) {
  const Counter = getCounterModel(connection);
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );

  return counter.seq;
}

async function getNextAvailableUserId(User) {
  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const seq = await getNextSequence(User.db, "userId");
    const userId = `USR-${String(seq).padStart(6, "0")}`;
    const exists = await User.exists({ userId });
    if (!exists) return userId;
  }

  throw new Error("Unable to generate a unique user ID");
}

export const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      immutable: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]+$/, "First name contains invalid characters"],
      validate: {
        validator: (v) => !/https?:\/\//.test(v),
        message: "URLs are not allowed in first name",
      },
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]+$/, "Last name contains invalid characters"],
      validate: {
        validator: (v) => !/https?:\/\//.test(v),
        message: "URLs are not allowed in last name",
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: [
        {
          validator: (value) => !/https?:\/\//.test(value),
          message: "URLs are not allowed in email",
        },
        {
          validator: (value) => /^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value),
          message: "Invalid email format",
        },
      ],
    },
    passwordHash: {
      type: String,
      required: function requirePasswordForActiveAccount() {
        return this.status !== "invited";
      },
      select: false,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "invited", "locked"],
      default: "invited",
      index: true,
    },
    lastLogin: {
      type: Date,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
  },
  { timestamps: true }
);

UserSchema.index({ status: 1, role: 1 });
UserSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });
UserSchema.index(
  { doctorId: 1 },
  {
    unique: true,
    partialFilterExpression: { doctorId: { $type: "objectId" } },
  }
);

UserSchema.pre("save", async function generateUserId() {
  if (this.userId) return;

  this.userId = await getNextAvailableUserId(this.constructor);
});

export function getUserModel(connection = mongoose) {
  return connection.models.User || connection.model("User", UserSchema);
}

export async function ensureUserDoctorIdIndex(User) {
  const connection = User.db;
  if (connection.__userDoctorIdIndexPromise) return connection.__userDoctorIdIndexPromise;

  connection.__userDoctorIdIndexPromise = (async () => {
    await User.updateMany({ doctorId: null }, { $unset: { doctorId: "" } });
    await User.collection.dropIndex("doctorId_1").catch((error) => {
      if (error?.codeName !== "IndexNotFound") throw error;
    });
    await User.collection.createIndex(
      { doctorId: 1 },
      {
        unique: true,
        partialFilterExpression: { doctorId: { $type: "objectId" } },
        name: "doctorId_1",
      }
    );
  })().catch((error) => {
    connection.__userDoctorIdIndexPromise = null;
    throw error;
  });

  return connection.__userDoctorIdIndexPromise;
}

const User = getUserModel();
export default User;

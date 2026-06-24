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
          validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
          message: "Invalid email format",
        },
      ],
    },
    passwordHash: {
      type: String,
      required: true,
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
  },
  { timestamps: true }
);

UserSchema.index({ status: 1, role: 1 });
UserSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

UserSchema.pre("save", async function generateUserId() {
  if (this.userId) return;

  const seq = await getNextSequence(this.constructor.db, "userId");
  this.userId = `USR-${String(seq).padStart(6, "0")}`;
});

export function getUserModel(connection = mongoose) {
  return connection.models.User || connection.model("User", UserSchema);
}

const User = getUserModel();
export default User;

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
    { new: true, upsert: true }
  );

  return counter.seq;
}

export const DeveloperUserSchema = new mongoose.Schema(
  {
    developerUserId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
    },
    singletonKey: {
      type: String,
      default: "system-owner",
      unique: true,
      immutable: true,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: "Invalid email format",
      },
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    isSystemOwner: {
      type: Boolean,
      default: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "locked"],
      default: "active",
      index: true,
    },
    lastLogin: {
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
  },
  { timestamps: true }
);

DeveloperUserSchema.index({ email: 1 }, { unique: true });
DeveloperUserSchema.index({ developerUserId: 1 }, { unique: true });
DeveloperUserSchema.index({ singletonKey: 1 }, { unique: true });
DeveloperUserSchema.index({ status: 1 });
DeveloperUserSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

DeveloperUserSchema.pre("save", async function generateDeveloperUserId() {
  if (this.developerUserId) return;

  const seq = await getNextSequence(this.constructor.db, "developerUserId");
  this.developerUserId = `DEV-${String(seq).padStart(6, "0")}`;
});

// Master DB only: the single full-access system owner, separate from tenant users.
export function getDeveloperUserModel(connection = mongoose) {
  return (
    connection.models.DeveloperUser ||
    connection.model("DeveloperUser", DeveloperUserSchema)
  );
}

const DeveloperUser = getDeveloperUserModel();
export default DeveloperUser;

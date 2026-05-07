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

export const PermissionSchema = new mongoose.Schema(
  {
    permissionId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z]+(?:\.[a-z]+)+$/,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    scope: {
      type: String,
      enum: ["tenant", "developer"],
      default: "tenant",
      index: true,
    },
    category: {
      type: String,
      trim: true,
      lowercase: true,
      default: "general",
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    dependencies: {
      type: [
        {
          type: String,
          trim: true,
          lowercase: true,
          match: /^[a-z]+(?:\.[a-z]+)+$/,
        },
      ],
      default: [],
    },
    availableForPlans: {
      type: [
        {
          type: String,
          enum: ["trial", "basic", "professional", "enterprise"],
        },
      ],
      default: ["trial", "basic", "professional", "enterprise"],
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
    isDangerous: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeveloperUser",
    },
  },
  { timestamps: true }
);

PermissionSchema.index({ module: 1, action: 1 });
PermissionSchema.index({ scope: 1, isActive: 1 });
PermissionSchema.index({ category: 1, module: 1, sortOrder: 1 });

PermissionSchema.pre("save", async function generatePermissionId() {
  if (this.permissionId) return;

  const seq = await getNextSequence(this.constructor.db, "permissionId");
  this.permissionId = `PERM-${String(seq).padStart(6, "0")}`;
});

// Master DB only: tenants may assign these keys, but must not create permissions.
export function getPermissionModel(connection = mongoose) {
  return (
    connection.models.Permission ||
    connection.model("Permission", PermissionSchema)
  );
}

const Permission = getPermissionModel();
export default Permission;

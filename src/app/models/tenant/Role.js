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

const permissionKeySchema = {
  type: String,
  trim: true,
  lowercase: true,
  match: /^(?:\*|[a-z]+(?:\.[a-z]+)+)$/,
};

export const RoleSchema = new mongoose.Schema(
  {
    roleId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    permissions: {
      type: [permissionKeySchema],
      default: [],
    },
    isDefaultAdmin: {
      type: Boolean,
      default: false,
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

RoleSchema.index({ name: 1 }, { unique: true });

RoleSchema.pre("save", async function generateRoleId() {
  if (this.roleId) return;

  const seq = await getNextSequence(this.constructor.db, "roleId");
  this.roleId = `ROLE-${String(seq).padStart(6, "0")}`;
});

// Tenant DB only: permissions are assigned as keys from the Master DB catalog.
export function getRoleModel(connection = mongoose) {
  return connection.models.Role || connection.model("Role", RoleSchema);
}

const Role = getRoleModel();
export default Role;

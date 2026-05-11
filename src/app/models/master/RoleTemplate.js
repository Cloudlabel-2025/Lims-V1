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

const permissionKeySchema = {
  type: String,
  trim: true,
  lowercase: true,
  match: /^(?:\*|[a-z]+(?:\.[a-z]+)+)$/,
};

export const RoleTemplateSchema = new mongoose.Schema(
  {
    roleTemplateId: {
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
    scope: {
      type: String,
      enum: ["tenant"],
      default: "tenant",
      immutable: true,
    },
    permissions: {
      type: [permissionKeySchema],
      default: [],
    },
    category: {
      type: String,
      trim: true,
      lowercase: true,
      default: "general",
      index: true,
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
    isDefaultAdmin: {
      type: Boolean,
      default: false,
    },
    isSystemTemplate: {
      type: Boolean,
      default: true,
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

RoleTemplateSchema.index({ roleTemplateId: 1 }, { unique: true });
RoleTemplateSchema.index({ category: 1, sortOrder: 1 });
RoleTemplateSchema.index({ isActive: 1, isDefaultAdmin: 1 });

RoleTemplateSchema.pre("save", async function generateRoleTemplateId() {
  if (this.roleTemplateId) return;

  const seq = await getNextSequence(this.constructor.db, "roleTemplateId");
  this.roleTemplateId = `RTPL-${String(seq).padStart(6, "0")}`;
});

// Master DB only: copied into each tenant DB during lab onboarding.
export function getRoleTemplateModel(connection = mongoose) {
  return (
    connection.models.RoleTemplate ||
    connection.model("RoleTemplate", RoleTemplateSchema)
  );
}

const RoleTemplate = getRoleTemplateModel();
export default RoleTemplate;

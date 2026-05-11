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

export const LabSchema = new mongoose.Schema(
  {
    labId: {
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
      maxlength: 120,
    },
    tenantId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    dbName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    dbConnectionString: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "archived"],
      default: "pending",
      index: true,
    },
    contactName: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: "Invalid contact email format",
      },
    },
    contactPhone: {
      type: String,
      trim: true,
      validate: {
        validator: (value) => !value || /^\d{10}$/.test(value),
        message: "Contact phone must be exactly 10 digits",
      },
    },
    subscriptionPlan: {
      type: String,
      enum: ["trial", "basic", "professional", "enterprise"],
      default: "trial",
    },
    enabledModules: {
      type: [String],
      default: ["dashboard", "patients", "doctors", "tests", "reports"],
    },
    adminAccess: {
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      password: {
        type: String,
        trim: true,
      },
      updatedAt: {
        type: Date,
      },
    },
    branding: {
      logo: {
        url: {
          type: String,
          trim: true,
        },
        storageKey: {
          type: String,
          trim: true,
          select: false,
        },
        publicId: {
          type: String,
          trim: true,
          select: false,
        },
        originalName: {
          type: String,
          trim: true,
        },
        size: {
          type: Number,
          min: 0,
        },
        mimeType: {
          type: String,
          trim: true,
        },
        altText: {
          type: String,
          trim: true,
          maxlength: 120,
        },
        uploadedAt: {
          type: Date,
        },
      },
      primaryColor: {
        type: String,
        trim: true,
        match: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
        default: "#0f766e",
      },
      secondaryColor: {
        type: String,
        trim: true,
        match: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
        default: "#164e63",
      },
      accentColor: {
        type: String,
        trim: true,
        match: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
        default: "#f59e0b",
      },
      loginHighlights: {
        type: [
          {
            type: String,
            trim: true,
            maxlength: 80,
          },
        ],
        default: [],
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeveloperUser",
    },
  },
  { timestamps: true }
);

LabSchema.index({ name: 1 });
LabSchema.index({ tenantId: 1, status: 1 });

LabSchema.pre("save", async function generateLabId() {
  if (this.labId) return;

  const seq = await getNextSequence(this.constructor.db, "labId");
  this.labId = `LAB-${String(seq).padStart(6, "0")}`;
});

export function getLabModel(connection = mongoose) {
  return connection.models.Lab || connection.model("Lab", LabSchema);
}

const Lab = getLabModel();
export default Lab;

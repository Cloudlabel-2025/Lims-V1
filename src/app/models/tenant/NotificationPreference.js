import mongoose from "mongoose";

export const NotificationPreferenceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    categories: {
      reports: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      samples: { type: Boolean, default: true },
      doctors: { type: Boolean, default: true },
      billing: { type: Boolean, default: true },
      subscription: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

NotificationPreferenceSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export function getNotificationPreferenceModel(connection = mongoose) {
  return connection.models.NotificationPreference || connection.model("NotificationPreference", NotificationPreferenceSchema);
}

const NotificationPreference = getNotificationPreferenceModel();
export default NotificationPreference;

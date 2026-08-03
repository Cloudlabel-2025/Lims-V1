import mongoose from "mongoose";

export const NotificationReadSchema = new mongoose.Schema(
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
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

NotificationReadSchema.index({ tenantId: 1, userId: 1, type: 1 }, { unique: true });

export function getNotificationReadModel(connection = mongoose) {
  return connection.models.NotificationRead || connection.model("NotificationRead", NotificationReadSchema);
}

const NotificationRead = getNotificationReadModel();
export default NotificationRead;

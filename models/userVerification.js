import mongoose, { Schema } from "mongoose";

const userVerificationSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    token: {
      type: String,
    },
  },
  { timestamps: true }
);

export const UserVerification = mongoose.model(
  "UserVerification",
  userVerificationSchema
);

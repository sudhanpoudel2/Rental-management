import mongoose, { Schema } from "mongoose";

const enquirySchema = new Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
    customer_email: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    mobile_no: {
      type: Number,
      required: true,
    },
    message: {
      type: String,
    },
  },
  { timestamps: true }
);
export const Enquiry = mongoose.model("Enquiry", enquirySchema);

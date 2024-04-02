import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const imageSchema = new Schema({
  _id: {
    type: String,
    default: uuidv4,
  },
  url: {
    type: String,
    required: true,
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    // required: true,
  },
});

const roomSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    userName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    is_available: {
      type: Boolean,
      default: true,
      required: true,
    },
    images: [imageSchema],
    amenities: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

export const Room = mongoose.model("Room", roomSchema);

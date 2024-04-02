import mongoose, { Schema } from "mongoose";
import validator from "validator";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
    },
    email: {
      type: String,
      required: [true, "email is required"],
      unique: true,
      validator: validator.isEmail,
    },
    address: {
      type: String,
      required: [true, "address is required"],
    },
    mobile_no: {
      type: String,
      required: [true, "contact is required"],
    },
    profile_picture: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      required: [true, "Passcode is required"],
      minlength: [6, "password length should be minimum 6 characters"],
    },
    isVerified: {
      type: Boolean, // Change type to Boolean
      default: false, // Set default value to false
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
    token: {
      type: String,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);

import express from "express";
import { User } from "../models/userModel.js";
import { UserVerification } from "../models/userVerification.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv/config.js";
import multer from "multer";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import Randomstring from "randomstring";
import verifyUser from "../middleware/auth.js";
import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";

import { v4 as uuidv4 } from "uuid";
import { error, log } from "console";

const router = express.Router();

const FILE_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

// Function to ensure directory exists
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const isValid = FILE_TYPE_MAP[file.mimetype];
    let uploadError = new Error("invalid image type");

    if (isValid) {
      uploadError = null;
    }

    // Get the current working directory
    const currentWorkingDirectory = process.cwd();

    // Specify the relative path to the destination directory
    const destinationDirectory = path.join(
      currentWorkingDirectory,
      "public",
      "image"
    );

    // Ensure the destination directory exists
    ensureDirectoryExists(destinationDirectory);

    cb(uploadError, destinationDirectory);
  },
  filename: function (req, file, cb) {
    const fileName = file.originalname.split(" ").join("_");
    const extension = FILE_TYPE_MAP[file.mimetype];
    cb(null, `${fileName}-${Date.now()}.${extension}`);
  },
});

const upload = multer({ storage: storage });
const gmail = process.env.GMAIL;
const passcode = process.env.PASS;

//nodemailer stuff
import tls from "tls";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: gmail,
    pass: passcode,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// tesing success
transporter.verify((error, success) => {
  if (error) {
    console.log(error);
  } else {
    // console.log("Ready for message");
    // console.log(success);
  }
});

router.post("/register", upload.single("profile_picture"), async (req, res) => {
  const requiredFields = [
    "name",
    "email",
    "address",
    "mobile_no",
    "password",
    "password2",
  ];
  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // const filename = req.file.filename;
  // const basePath = `${req.protocol}://${req.get("host")}/public/image/`;

  try {
    console.log("Hello i am working!!!");
    const existingUser = await User.findOne({ email: req.body.email });

    if (existingUser) {
      return res.status(400).json({
        message: "User with this email already exists .",
      });
    }

    if (req.body.password !== req.body.password2) {
      return res
        .status(400)
        .json({ message: "Passwords and conformPassword did not match" });
    }
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const register = new User({
      userId: req.body.userId,
      name: req.body.name,
      email: req.body.email,
      address: req.body.address,
      mobile_no: req.body.mobile_no,
      profile_picture: null,
      password: hashedPassword,
      password2: hashedPassword,
      isVerified: false,
    });
    register.save().then((result) => {
      //handle account verification
      sendVerificationEmail(result, res);
    });
  } catch (error) {
    res.status(400).json({ Error: error, message: "user can not register " });
  }
});

const sendVerificationEmail = async ({ _id, email, req }, res) => {
  //url to be used in email
  const currentUrl = process.env.URL;
  // const currentUrl = req.headers.host;
  const uniqueString = uuidv4() + _id;

  try {
    // Set value in userverification collection
    const newVerification = new UserVerification({
      userId: _id,
      token: uniqueString,
    });

    await newVerification.save();

    // Mail options
    const mailOptions = {
      from: gmail,
      to: email,
      subject: "Verify Your Email",
      html: `
        <p>Dear user,</p>
        <p>Thank you for registering. Please click the link below to verify your email address:</p>
        <p><a href="${currentUrl}user/verify/${_id}/${uniqueString}">Verify Email</a></p>
       
        <p>If you did not register for an account, please ignore this email.</p>
        <p>Regards,</p>
        <p>Your App Team</p>
      `,
    };

    // Send verification email
    await transporter.sendMail(mailOptions);

    // Return success message
    res.status(200).json({
      message: "Link has been sent to your email. Click the link to verify.",
    });
  } catch (error) {
    console.error("Error sending verification email:", error);
    res.status(400).json({
      status: "FAILED",
      message: "Verification email failed to send.",
    });
  }
};

router.get("/verify/:userId/:uniqueString", async (req, res) => {
  const { userId, uniqueString } = req.params;
  console.log("Received GET request to /verify/:userId/:uniqueString");
  console.log("userId:", userId);
  console.log("uniqueString:", uniqueString);

  try {
    // Find the user verification record associated with the userId
    const verificationRecord = await UserVerification.findOne({ userId });

    if (!verificationRecord) {
      console.log("Verification record not found for userId:", userId);
      return res.status(404).json({ message: "Verification record not found" });
    }

    const { token } = verificationRecord;

    if (uniqueString === token) {
      console.log("Verification successful for userId:", userId);
      // Update the user record to mark it as verified
      await User.updateOne({ _id: userId }, { isVerified: true });

      const user = await User.findById(userId);
      const email = user.email;

      await UserVerification.deleteOne({ userId });

      // Send success email
      const successMailOptions = {
        from: gmail,
        to: email,
        subject: "Email Verification Successful",
        html: `
          <p>Dear user,</p>
          <p>Your email has been successfully verified!</p>
          <p>You can now access your account and enjoy our services.</p>
          <p>Regards,</p>
          <p>Your App Team</p>
        `,
      };

      await transporter.sendMail(successMailOptions);

      return res.status(200).json({ message: "Email verified successfully" });
    } else {
      console.log("Invalid verification details for userId:", userId);
      return res.status(400).json({
        message: "Invalid verification details. Please check your inbox.",
      });
    }
  } catch (error) {
    console.error("Error verifying email:", error);
    return res.status(500).json({
      message: "Internal server error while verifying email",
    });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const userData = await User.findOne({ email });

    if (!userData) {
      return res.status(404).json({ message: "Invalid credentials!!" });
    }

    const passwordMatch = await bcrypt.compare(password, userData.password);

    if (!passwordMatch) {
      return res.status(406).json({ message: "Invalid credentials!!" });
    }

    if (!userData.isVerified) {
      return res.status(400).json({ message: "Please verify your email" });
    }

    const secret = process.env.SECRET;
    const token = jwt.sign({ userId: userData._id }, secret);

    return res.status(202).json({
      name: userData.name,
      mobile_no: userData.mobile_no,
      address: userData.address,
      email: userData.email,
      porfile_picture: userData.porfile_picture,
      token: { access: token },
      message: "Login successful",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      message: "Error occurred while logging in",
    });
  }
});

// router.post("/forget-password", verifyUser, async (req, res) => {
//   try {
//     const email = req.body.email;
//     const userData = User.findOne({ email: email });
//     if (userData) {
//       if (userData.isVarified === 0) {
//         res.status(200).json({ data: {}, message: "Please verify your mail" });
//       } else {
//         const OTP = otpGenerator.generate(4, {
//           upperCaseAlphabets: false,
//           specialChars: false,
//         });

//     const newData = await User.updateOne(
//       { email: email },
//       { $set: { token: OTP } }
//     );
//     sendResetPasswordMail(userData.name, userData.email, OTP);
//     res
//       .status(200)
//       .json({ message: "please check you mail to reset password!" });
//   }
// } else {
//   res.status(400).json({ message: "user email is incorrect" });
// }
//   } catch (error) {
//     res.status(400).json({ Error: error, message: "hello hi" });
//   }
// });

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const otp = otpGenerator.generate(4, {
      digits: true,
      upperCase: false,
      specialChars: false,
    });

    const mailOptions = {
      from: gmail,
      to: email,
      subject: "Reset Password OTP",
      text: `Your OTP for password reset is: ${otp}`,
    };

    transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Error sending email" });
      } else {
        console.log("Email sent:", info.response);

        const user = await User.findOneAndUpdate(
          { email },
          { token: otp },
          { new: true }
        );

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "OTP sent successfully" });
      }
    });
  } catch (error) {
    console.error("Error generating OTP:", error);
    res.status(500).json({ message: "Error generating OTP" });
  }
});

const tokenToEmailMap = new Map();

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.token !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const token = uuidv4();

    tokenToEmailMap.set(token, email);

    await User.findOneAndUpdate(
      { email },
      { $unset: { token: "" } },
      { new: true }
    );

    res.status(200).json({ message: "OTP verified successfully", token });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Error verifying OTP" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, password, password2 } = req.body;

  try {
    if (!token || !password || !password2) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const email = tokenToEmailMap.get(token);

    if (!email) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    if (password !== password2) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await User.updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    if (result.nModified === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove the token from the map after password reset
    tokenToEmailMap.delete(token);

    // Respond with success message
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// router.post("/verify-otp", async (req, res) => {
//   const { email, otp } = req.body;

//   // try {
//   // Find the user by email and check if the OTP matches
//   const user = await User.findOne({ email });

//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   if (user.token !== otp) {
//     return res.status(400).json({ message: "Invalid OTP" });
//   }

//   // Clear the OTP from the user's model after verification
//   await User.findOneAndUpdate(
//     { email },
//     { $unset: { token: "" } },
//     { new: true }
//   );

//   res.status(200).json({ message: "OTP verified successfully" });
//   // } catch (error) {
//   //   console.error("Error verifying OTP:", error);
//   //   res.status(500).json({ message: "Error verifying OTP" });
//   // }
// });

// router.post("/reset-password", async (req, res) => {
//   const { email, password, password2 } = req.body;

//   try {
//     if (!email || !password || !password2) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     if (password !== password2) {
//       return res.status(400).json({ message: "Passwords do not match" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const result = await User.updateOne(
//       { email },
//       { $set: { password: hashedPassword } }
//     );

//     if (result.nModified === 0) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.status(200).json({ message: "Password reset successfully" });
//   } catch (error) {
//     console.error("Error resetting password:", error);
//     res.status(500).json({ message: "Error resetting password" });
//   }
// });

router.put("/change-password", verifyUser, async (req, res) => {
  const userId = req.userInfo._id;
  const { old_password, password, password2 } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(old_password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (password !== password2) {
      return res
        .status(400)
        .json({ message: "New password and confirm password do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
});

export default router;

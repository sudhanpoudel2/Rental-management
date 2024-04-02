import express from "express";
import { Enquiry } from "../models/enquiryModel.js";
import { User } from "../models/userModel.js";
import { Room } from "../models/roomModel.js";
import verifyUser from "../middleware/auth.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv/config.js";
import multer from "multer";
import path from "path";
import fs from "fs";

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
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: gmail,
    pass: passcode,
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

router.post("/enquiry", verifyUser, async (req, res) => {
  const userId = req.userInfo._id;

  try {
    const user = await User.findOne({ _id: userId });
    console.log(userId);

    if (!user || !user.email) {
      return res
        .status(404)
        .json({ message: "User not found or email not available" });
    }
    console.log(user.email);

    const room = await Room.findById(req.body.roomId).populate("user");

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (!room.is_available) {
      return res
        .status(400)
        .json({ message: "Room is not available for enquiry" });
    }

    if (String(room.user._id) === String(userId)) {
      return res
        .status(400)
        .json({ message: "Cannot enquire in your own added room" });
    }

    const userName = room.user.name;

    const newEnquiry = new Enquiry({
      customer_email: user.email,
      room: req.body.roomId,
      name: req.body.name,
      mobile_no: req.body.mobile_no,
      message: req.body.message,
    });

    const registerEnquiry = await newEnquiry.save();

    const mailOption = {
      from: gmail,
      to: room.user.email,
      subject: "Room Enquiry!!",
      html: `<h1> ${userName}</h1><br/><p><ul><li>Customer email: ${user.email}</li><li>Customer name: ${req.body.name}</li><li>Mobile number: ${req.body.mobile_no}</li><li>Message: ${req.body.message}</li></ul></p>`,
    };

    transporter.sendMail(mailOption, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    res
      .status(200)
      .json({ data: registerEnquiry, message: "Enquiry sent successfully!!!" });
  } catch (error) {
    console.error("Error adding enquiry:", error);
    res.status(500).json({ message: "Error adding enquiry" });
  }
});

router.get("/enquiryList", verifyUser, async (req, res) => {
  try {
    const userId = req.userInfo._id;
    // const { page = 1, limit = 10 } = req.query;
    // const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    const customer_email = user.email;
    console.log(customer_email);

    if (!customer_email) {
      res.status(400).send({ message: "user not found" });
    }

    const enquiries = await Enquiry.find({ customer_email });
    console.log(customer_email);
    console.log(enquiries);
    // const totalCount = await Enquiry.countDocuments({ customer_email });
    // const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      result: enquiries,
      // count: totalCount,
      // previous: page > 1 ? page - 1 : null,
      // next: page < totalPages ? parseInt(page) + 1 : null,
      message: "Enquiries retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving user enquiries:", error);
    res.status(500).json({
      result: [],
      message: "Failed to retrieve user enquiries",
    });
  }
});

router.get("/room", verifyUser, async (req, res) => {
  try {
    const user = req.userInfo._id;

    const userData = await User.findById(user);

    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    console.log(user);
    const rooms = await Room.find({ user: user })
      .populate("user", "name")
      .skip(skip)
      .limit(limit);

    const totalCount = await Room.countDocuments({ user: user });
    const totalPages = Math.ceil(totalCount / limit);

    const roomsWithUserNameEmailAndImages = rooms.map((room) => ({
      ...room.toObject(),
      userName: room.user.name,
      images: room.images.map(({ _id, url }) => ({ _id, url })),
    }));

    res.status(200).json({
      result: roomsWithUserNameEmailAndImages,
      count: totalCount,
      previous: page > 1 ? page - 1 : null,
      next: page < totalPages ? parseInt(page) + 1 : null,
      message: "Rooms retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving rooms:", error);
    res.status(500).json({
      result: [],
      message: "Failed to retrieve rooms",
    });
  }
});

// router.get("/room", verifyUser, async (req, res) => {
//   try {
//     const userId = req.userInfo._id;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 3;

//     const skip = (page - 1) * limit;

//     const userRooms = await Room.find({ user: userId }).skip(skip).limit(limit);

//     console.log(userRooms);

//     if (!userRooms || userRooms.length === 0) {
//       return res.status(404).json({ message: "No rooms found for this user" });
//     }

//     const formattedRooms = userRooms.map((room) => {
//       const formattedImages = room.images.map((image) => image.url); // Assuming 'url' is the field where image URLs are stored
//       return {
//         ...room.toObject(),
//         images: formattedImages,
//       };
//     });

//     res.status(200).json({
//       message: "Room List found successfully!!",
//       data: formattedRooms,
//       currentPage: page,
//     });
//   } catch (error) {
//     console.error("Error fetching user rooms:", error);
//     res.status(500).json({ message: "Error fetching user rooms" });
//   }
// });

// router.get("/room", verifyUser, async (req, res) => {
//   try {
//     const userId = req.userInfo._id;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 3;

//     const skip = (page - 1) * limit;

//     const userRooms = await Room.find({ user: userId }).skip(skip).limit(limit);

//     console.log(userRooms);

//     if (!userRooms || userRooms.length === 0) {
//       return res.status(404).json({ message: "No rooms found for this user" });
//     }

//     // const totalRoom = await Room.countDocuments({ userId: userId });

//     res.status(200).json({
//       message: "Room List found successfully!!",
//       data: userRooms,
//       currentPage: page,
//       // totalPage: Math.ceil(totalRoom / limit),
//     });
//   } catch (error) {
//     console.error("Error fetching user rooms:", error);
//     res.status(500).json({ message: "Error fetching user rooms" });
//   }
// });

router.get("/", async (req, res) => {
  try {
    const users = await User.find();
    if (!users) {
      res.status(404).json({ message: "No users found", data: {} });
    } else {
      res.status(200).json({ message: "Users found", data: users });
    }
  } catch (error) {
    res.status(500).json({ Error: error, message: "Failed to fetch users" });
  }
});

router.put("/update", upload.single("image"), verifyUser, async (req, res) => {
  const userId = req.userInfo._id;
  const updateFields = {};

  if (req.file) {
    const filename = req.file.filename;
    const basePath = `${req.protocol}://${req.get("host")}/public/image/`;
    updateFields.porfile_picture = `${basePath}${filename}`;
  }

  if (req.body.name) {
    updateFields.name = req.body.name;
  }
  if (req.body.address) {
    updateFields.address = req.body.address;
  }
  if (req.body.mobile_no) {
    updateFields.mobile_no = req.body.mobile_no;
  }

  try {
    const update = await User.findByIdAndUpdate(userId, updateFields, {
      new: true, // Return the updated document
    });

    if (!update) {
      return res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ Error: error, message: "Failed to update user" });
  }
});
export default router;

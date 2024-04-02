import express from "express";
import { Room } from "../models/roomModel.js";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "fs";
import verifyUser from "../middleware/auth.js";
import { userInfo } from "os";
import { User } from "../models/userModel.js";
import moment from "moment/moment.js";
import { v4 as uuidv4 } from "uuid";
import { Enquiry } from "../models/enquiryModel.js";

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
    // const isValid = FILE_TYPE_MAP[file.mimetype];
    // let uploadError = new Error("Invalid image type");

    // if (!isValid) {
    //   uploadError = new Error("Invalid image type");
    //   return cb(uploadError);
    // }

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

    cb(null, destinationDirectory);
  },
  filename: function (req, file, cb) {
    const fileName = file.originalname.split(" ").join("_");
    const extension = FILE_TYPE_MAP[file.mimetype];
    cb(null, `${fileName}-${Date.now()}.${extension}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024, // Maximum size for each image
    files: 4, // Adjust the maximum number of files
  },
});
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "public/image");
//   },
//   filename: (req, file, cb) => {
//     const { originalname } = file;
//     cb(null, `${uuidv4()}-${originalname}`);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg"];
//   if (allowedMimeTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE"), false);
//   }
// };

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 1024 * 1024, files: 2 },
// });

// router.use(upload.any());

// const multiUplaod = upload.fields({ name: "images", maxCount: 4 });
router.post("/add", upload.array("images"), verifyUser, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400).send({ message: "no file uploded!!" });
      console.log("hello");
    } else if (req.files.length > 4) {
      console.log("Number of uploaded files:", req.files.length);
      res.status(400).send({
        message: "You can upload a maximum of 4 images.",
        maxAllowedImages: 4,
      });
    }

    const invalidFiles = [];
    for (const file of req.files) {
      // Check image type
      const extension = path.extname(file.originalname).toLowerCase();
      if (![".png", ".jpg", ".jpeg"].includes(extension)) {
        invalidFiles.push(file.originalname);
      } else if (file.size > 1024 * 1024) {
        invalidFiles.push(file.originalname);
      }
    }

    if (invalidFiles.length > 0) {
      return res.status(400).json({
        message: `Please upload only PNG, JPEG, or JPG images within 1 MB size limit.`,
      });
    }

    // Check for invalid image types

    // Proceed with further processing if the file count is within the limit
    // For example, you might check file types, sizes, etc.
    // Continue with your existing code...

    // const basePath = `${req.protocol}://${req.get("host")}/public/image/`;
    // // const images = req.files.map((file) => `${basePath}${file.filename}`);
    // const imagesData = req.files.map((file) => ({
    //   _id: uuidv4(), // Generate unique ID for each image
    //   url: `${basePath}${file.filename}`,
    //   roomId: null, // Placeholder for room ID
    // }));

    const user = req.userInfo._id;
    const userDetail = await User.findOne({ _id: user });

    if (!userDetail || !userDetail.name) {
      return res
        .status(404)
        .json({ message: "User not found or user name is missing" });
    }

    const newRoom = new Room({
      user,
      userName: userDetail.name,
      category: req.body.category,
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      location: req.body.location,
      city: req.body.city,
      is_available: true,
      // images: imagesData,
      amenities: req.body.amenities,
    });

    const savedRoom = await newRoom.save();

    console.log("New Room Saved:", savedRoom);
    const basePath = `${req.protocol}://${req.get("host")}/public/image/`;
    const imagesData = req.files.map((file) => ({
      _id: uuidv4(), // Generate unique ID for each image
      url: `${basePath}${file.filename}`,
      roomId: savedRoom._id, // Use the _id of the saved room
    }));

    await Room.findByIdAndUpdate(savedRoom._id, {
      $push: { images: { $each: imagesData } },
    });

    const updatedRoom = await Room.findById(savedRoom._id);

    // Update images array in the room with the newly uploaded images
    // await Room.updateOne(
    //   { _id: savedRoom._id },
    //   { $push: { images: { $each: imagesData } } }
    // );

    // const responseData = { ...savedRoom.toObject() };
    // delete responseData.userId;
    const responseData = {
      ...updatedRoom.toObject(),
      userName: userDetail.name,
    };

    res.status(200).json({
      result: responseData,
      message: "Room registered successfully!",
    });
  } catch (error) {
    console.error("Error adding room:", error);
    res.status(400).json({
      result: {},
      message: "Error adding room",
    });
  }
});

// router.use((error, req, res, next) => {
//   if (error instanceof multer.MulterError) {
//     if (error.code === "LIMIT_FILE_SIZE") {
//       return res.status(400).send({ message: "File is too large" });
//     } else if (error.code === "LIMIT_FILE_COUNT") {
//       return res.status(400).send({ message: "File limit reached" });
//     } else if (req.files) {
//       const invalidFiles = req.files.filter((file) => {
//         const extension = path.extname(file.originalname).toLowerCase();
//         return ![".png", ".jpg", ".jpeg"].includes(extension);
//       });
//       if (invalidFiles.length > 0) {
//         return res
//           .status(400)
//           .send({ message: "Please upload only PNG, JPEG, or JPG images" });
//       }
//     }
//   } else if (error) {
//     return res.status(500).send({ message: "Internal server error" });
//   }

//   next(); // Pass control to the next middleware
// });

router.put(
  "/update/:roomId",
  upload.array("images", 4),
  verifyUser,
  async (req, res) => {
    try {
      const user = req.userInfo._id;
      const room_id = req.params.roomId;

      // Find the room by roomId and userId to ensure it belongs to the authenticated user
      const room = await Room.findOne({ _id: room_id, user: user });

      if (!room) {
        return res
          .status(404)
          .json({ message: "Room not found or not authorized to update" });
      }

      const updatedRoomData = {
        category: req.body.category || room.category,
        title: req.body.title || room.title,
        description: req.body.description || room.description,
        price: req.body.price || room.price,
        location: req.body.location || room.location,
        city: req.body.city || room.city,
        is_available:
          req.body.is_available !== undefined
            ? req.body.is_available
            : room.is_available,
        amenities: req.body.amenities || room.amenities,
      };

      let imagesData = room.images;
      if (req.files && req.files.length > 0) {
        const basePath = `${req.protocol}://${req.get("host")}/public/image/`;
        const newImagesData = req.files.map((file) => ({
          _id: uuidv4(),
          url: `${basePath}${file.filename}`,
          roomId: room_id,
        }));

        imagesData = imagesData.filter((existingImage) => {
          const found = newImagesData.find(
            (newImage) => newImage._id === existingImage._id
          );
          return !!found;
        });

        imagesData = [...imagesData, ...newImagesData]; // Concatenate existing and new images
      }

      const updatedRoom = await Room.findByIdAndUpdate(
        room_id,
        { ...updatedRoomData, images: imagesData },
        { new: true }
      );

      const responseData = {
        ...updatedRoom.toObject(),
      };

      res.status(200).json({
        result: responseData,
        message: "Room updated successfully!",
      });
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(400).json({
        result: {},
        message: "Error updating room",
      });
    }
  }
);

// Endpoint to retrieve all rooms with optional search, filters, and pagination
router.get("/list", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const removeSpace = req.query.search.replace(/\s{2,}/g, " ").trim();

    const searchQuery = removeSpace || "";

    const categoryFilter = req.query.category || "";
    const priceFilter = req.query.price || 0;
    const isAvailableFilter = req.query.is_available || "";
    const cityFilter = req.query.city || "";

    const query = {};

    if (searchQuery) {
      query.$or = [
        { title: { $regex: ".*" + searchQuery + ".*", $options: "i" } },
        { description: { $regex: ".*" + searchQuery + ".*", $options: "i" } },
      ];
    }

    if (categoryFilter) {
      query.category = categoryFilter;
    }

    if (priceFilter) {
      const [minPrice, maxPrice] = priceFilter.split("-").map(parseFloat);
      if (!isNaN(minPrice)) {
        query.price = { $gte: minPrice };
      }
      if (!isNaN(maxPrice)) {
        // If query.price already exists, merge the $lte condition
        query.price = { ...query.price, $lte: maxPrice };
      }
    }

    if (isAvailableFilter !== "") {
      query.is_available = isAvailableFilter.toLowerCase() === "true";
    }

    if (cityFilter) {
      query.city = cityFilter;
    }
    console.log(query);

    const rooms = await Room.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const totalCount = await Room.countDocuments(query);

    res.status(200).json({
      rooms,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(400).json({
      message: "Error fetching rooms",
    });
  }
});

// router.get("/list", async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       search = "",
//       category = "",
//       price_min = 0,
//       price_max = Number.MAX_SAFE_INTEGER,
//       city = "",
//       is_available = true,
//     } = req.query;

//     const skip = (page - 1) * limit;

//     const numericMinPrice = parseInt(price_min);
//     const numericMaxPrice = parseInt(price_max);

//     const isAvailableBoolean = is_available === "true";

//     const query = {
//       title: { $regex: ".*" + search + ".*", $options: "i" },
//     };
//     // const query = {
//     //   title: { $regex: ".*static_search_query.*", $options: "i" },
//     //   // Add other query conditions...
//     // };

//     if (category) {
//       query.category = category;
//     }

//     if (city) {
//       query.city = city;
//     }

//     if (price_min !== undefined || price_max !== undefined) {
//       query.price = {
//         $gte: numericMinPrice,
//         $lte: numericMaxPrice,
//       };
//     }

//     if (is_available !== undefined) {
//       query.is_available = isAvailableBoolean;
//     }

//     console.log("Query:", query);

//     const rooms = await Room.find()
//       .populate("user", "name")
//       .skip(skip)
//       .limit(limit);

//     console.log("Rooms:", rooms);

//     const totalCount = await Room.countDocuments(query);
//     const totalPages = Math.ceil(totalCount / limit);

//     const roomsWithUserNameAndImages = rooms.map((room) => ({
//       ...room.toObject(),
//       userName: room.user.name,
//       images: room.images.map(({ _id, url }) => ({ _id, url })),
//     }));

//     res.status(200).json({
//       results: roomsWithUserNameAndImages,
//       count: totalCount,
//       previous: page > 1 ? page - 1 : null,
//       next: page < totalPages ? parseInt(page) + 1 : null,
//       message: "Rooms retrieved successfully",
//     });
//   } catch (error) {
//     console.error("Error retrieving rooms:", error);
//     res.status(500).json({
//       results: [],
//       message: "Failed to retrieve rooms",
//     });
//   }
// });

// router.delete("/delete/:roomId", verifyUser, async (req, res) => {
//   try {
//     const user = req.userInfo._id;
//     const room_id = req.params.roomId;

//     // Find the room to delete
//     const room = await Room.findByIdAndDelete({
//       _id: room_id,
//       user: user,
//     });

//     if (!room) {
//       return res
//         .status(404)
//         .json({ message: "Room not found or not authorized to delete" });
//     }

//     res.status(200).json({
//       message: "Room deleted successfully!",
//     });
//   } catch (error) {
//     console.error("Error deleting room:", error);
//     res.status(400).json({
//       message: "Error deleting room",
//     });
//   }
// });

router.delete("/delete/:roomId", verifyUser, async (req, res) => {
  try {
    const user = req.userInfo._id;
    const room_id = req.params.roomId;

    const enquiryCount = await Enquiry.countDocuments({ room: room_id });

    if (enquiryCount > 0) {
      return res.status(403).json({
        message: "Cannot delete room with enquiry",
      });
    }

    const room = await Room.findOneAndDelete({
      _id: room_id,
      user: user,
    });

    if (!room) {
      return res
        .status(404)
        .json({ message: "Room not found or not authorized to delete" });
    }

    res.status(200).json({
      message: "Room deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(400).json({
      message: "Error deleting room",
    });
  }
});

router.get("/recently_added", async (req, res) => {
  try {
    const currentDate = new Date();

    // Calculate the date two days ago
    const twoDaysAgo = moment().subtract(2, "days").toDate();

    const query = { createdAt: { $gte: twoDaysAgo } };

    const recentlyAddedRooms = await Room.find(query);

    res.status(200).json({
      result: recentlyAddedRooms,
      message: "Recently added rooms retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving recently added rooms:", error);
    res.status(500).json({
      result: [],
      message: "Failed to retrieve recently added rooms",
    });
  }
});

export default router;

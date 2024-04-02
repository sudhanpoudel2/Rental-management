import jwt from "jsonwebtoken";
import dotenv from "dotenv/config.js";
import { User } from "../models/userModel.js";

const verifyUser = function (req, res, next) {
  try {
    // console.log("AUTHENTICATION HEADER:", req.headers.authorization);

    if (req.headers.authorization) {
      const authHeaderParts = req.headers.authorization.split(" ");
      // console.log("AUTHENTICATION HEADER PARTS:", authHeaderParts);

      if (authHeaderParts.length !== 2 || authHeaderParts[0] !== "Bearer") {
        // console.log("INVALID AUTHORIZATION HEADER FORMAT");
        return res
          .status(400)
          .json({ mesg: "Invalid authorization header format" });
      }

      const secret = process.env.SECRET;
      const token = authHeaderParts[1];
      const usertoken = jwt.verify(token, secret);
      // console.log("Token:", usertoken);
      // console.log("UserId:", usertoken.userId);

      // Set req.userInfo only if token is successfully verified
      req.userInfo = { _id: usertoken.userId };
      // req.userInfo = { name: usertoken.userId };
      // console.log("User Info:", req.userInfo);
    }

    // Call next() to pass control to the next middleware
    next();
  } catch (error) {
    res.status(400).json({
      Error: error,
      message: "Error occurred while authentication",
    });
  }
};

export default verifyUser;

import mongoose from "mongoose";
import dotenv from "dotenv/config";

export const dbConnection = mongoose
  .connect(process.env.DB_CONNECT)

  .then(() => {
    console.log("Database connection is ready.....");
  })
  .catch((error) => {
    console.log(`Error : ${error}`);
  });

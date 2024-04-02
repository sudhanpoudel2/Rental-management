import express from "express";
import { dbConnection } from "./DB/database.js";
import dotenv from "dotenv/config.js";
import userRouter from "./routes/userRoute.js";
import roomRouter from "./routes/roomRoute.js";
import enquiryRouter from "./routes/enquiryRoute.js";
import cors from "cors";
// import errorHandler from "./middleware/errorHandler.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
    // methods: ["GET,HEAD,PUT,PATCH,POST,DELETE"],
  })
);
// app.use(errorHandler);

app.use("/user", userRouter);
app.use("/room", roomRouter);
app.use("/profile", enquiryRouter);

app.listen(parseInt(process.env.PORT), () => {
  console.log(`Server is running at port ${process.env.PORT}`);
});

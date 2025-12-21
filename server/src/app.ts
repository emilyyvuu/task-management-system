import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { authRouter } from "./routes/auth.routes";

dotenv.config();

const app = express();

app.use(express.json()); 
app.use(cookieParser());   
app.use(cors({
  origin: process.env.WEB_ORIGIN,
  credentials: true,
}));

app.use("/api/auth", authRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

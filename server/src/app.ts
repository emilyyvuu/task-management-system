import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { pool } from "./db";

dotenv.config();

const app = express();

app.use(express.json()); 
app.use(cookieParser());   
app.use(cors({
  origin: process.env.WEB_ORIGIN,
  credentials: true,
}));

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

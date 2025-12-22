import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { authRouter } from "./routes/auth.routes";
import { orgsRouter } from "./routes/orgs.routes";
import { projectsRouter } from "./routes/projects.routes";
import { tasksRouter } from "./routes/tasks.routes";
import { auditRouter } from "./routes/audit.routes";
import { invitesRouter } from "./routes/invites.routes";
import { membersRouter } from "./routes/members.routes";
import { commentsRouter } from "./routes/comments.routes";

dotenv.config();

const app = express();

app.use(express.json()); 
app.use(cookieParser());   
app.use(cors({
  origin: process.env.WEB_ORIGIN,
  credentials: true,
}));

app.use("/api/auth", authRouter);
app.use("/api/orgs", orgsRouter);
app.use("/api", projectsRouter);
app.use("/api", tasksRouter);
app.use("/api", auditRouter);
app.use("/api", invitesRouter);
app.use("/api", membersRouter);
app.use("/api", commentsRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

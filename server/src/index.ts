import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authMiddleware } from "./middleware/authMiddleware";
import { generalLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import { sendSuccess } from "./utils/response";
import sessionsRouter from "./routes/sessions";
import attendanceRouter from "./routes/attendance";
import devicesRouter from "./routes/devices";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN?.split(",").map((o) => o.trim()) ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// No auth required — used by uptime checks / local sanity testing.
app.get("/api/health", (_req, res) => sendSuccess(res, { status: "ok" }));

app.use("/api", generalLimiter);

// Every route below requires a valid Firebase ID token; authMiddleware also
// attaches the AUTHORITATIVE role (read from Firestore, never trusted from
// the client) that requireRole() checks against.
app.use("/api/sessions", authMiddleware, sessionsRouter);
app.use("/api/attendance", authMiddleware, attendanceRouter);
app.use("/api/devices", authMiddleware, devicesRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: "not_found", message: "No such endpoint." } });
});

// Must be mounted last — see errorHandler.ts.
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Smart Attendance API listening on port ${port}`);
});

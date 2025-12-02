// app.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import bodyParser from "body-parser";
import { pool } from "./database/connection.js";

// Routes
import user from "./route/user.js";
import advising from "./route/advising.js";

const app = express();
const PORT = process.env.PORT || 10000;

// SECURITY
app.use(helmet({ frameguard: { action: "deny" } }));

// JSON
app.use(bodyParser.json());
app.use(express.json());

// CORS
app.use(cors({
  origin: [
    "http://127.0.0.1:5500",
    "http://localhost:5173",
    "https://oduadvisingportal.netlify.app",
  ],
  credentials: true,
}));

// STATIC FILES
app.use(express.static("client"));

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../client")));


// LOGGING
app.use((req, res, next) => {
  console.log(`📌 ${req.method} ${req.url}`);
  next();
});

// ROUTES
app.use("/user", user);
app.use("/advising", advising);

// ROOT
app.get("/", (req, res) => {
  res.json({ message: "Server is alive" });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// DB CHECK
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ MySQL Connected");
  } catch (e) {
    console.error("❌ DB FAILED", e.message);
  }
})();

// START
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

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

/* ------------------------------------------------------------------
   ✅ SECURITY — Prevent Clickjacking + XSS
------------------------------------------------------------------ */
app.use(
  helmet({
    frameguard: { action: "deny" },
  })
);

/* ------------------------------------------------------------------
   🔧 Keep MySQL Alive (prevents Clever Cloud timeout)
------------------------------------------------------------------ */
setInterval(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("🔄 MySQL keep-alive ping");
  } catch (err) {
    console.error("MySQL KeepAlive Error:", err);
  }
}, 1000 * 60 * 4); // every 4 minutes

/* ------------------------------------------------------------------
   📁 Serve client files
------------------------------------------------------------------ */
app.use(express.static("client"));

/* ------------------------------------------------------------------
   🌐 CORS
------------------------------------------------------------------ */
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5173",
      "https://oduadvisingportal.netlify.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

/* ------------------------------------------------------------------
   📝 Parse JSON
------------------------------------------------------------------ */
app.use(bodyParser.json());

/* ------------------------------------------------------------------
   🧭 Log requests (debugging)
------------------------------------------------------------------ */
app.use((req, res, next) => {
  console.log(`📌 ${req.method} ${req.url}`);
  next();
});

/* ------------------------------------------------------------------
   📌 API Routes
------------------------------------------------------------------ */
app.use("/user", user);
app.use("/advising", advising);

/* ------------------------------------------------------------------
   🏠 Root Route
------------------------------------------------------------------ */
app.get("/", (req, res) => {
  res.json({ status: 200, message: "🚀 Server running successfully!" });
});

/* ------------------------------------------------------------------
   ❌ 404 Handler
------------------------------------------------------------------ */
app.use((req, res) => {
  res.status(404).json({ status: 404, message: "Route not found 😢" });
});

/* ------------------------------------------------------------------
   🚀 Start Server
------------------------------------------------------------------ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});

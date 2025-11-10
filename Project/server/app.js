import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import user from "./route/user.js";

const app = express();
const PORT = process.env.PORT || 8080;

// --- Middleware ---
app.use(bodyParser.json());

// ✅ CORS (Allow both local + deployed frontend)
const allowedOrigins = [
  "http://127.0.0.1:5500",                 // local dev (Live Server)
  "http://localhost:5173",                 // local dev (Vite)
  "https://oduadvisingportal.netlify.app", // ✅ your live Netlify frontend
];

// ✅ Fix: simpler, safe dynamic CORS handler
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

// --- Simple logger ---
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// --- Routes ---
app.use("/user", user);

// --- Root route ---
app.get("/", (req, res) => {
  res.json({
    status: 200,
    message: "✅ Server is running successfully 🚀",
  });
});

// ✅ Fix for 502 errors on Render: handle unknown routes gracefully
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    message: "Route not found 😢",
  });
});

// --- Start server ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});

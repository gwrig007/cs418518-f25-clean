import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import user from "./route/user.js";
import advising from "./route/advising.js";

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Serve client files (like classes.html, style.css)
app.use(express.static("client"));

// ✅ CORS setup
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5173",
      "https://oduadvisingportal.netlify.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Handle preflight requests
app.options(/.*/, cors());

// ✅ Parse JSON bodies
app.use(bodyParser.json());

// ✅ Log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ✅ Routes
app.use("/user", user);
app.use("/advising", advising); // keep only THIS one

// ✅ Root route
app.get("/", (req, res) => {
  res.json({ status: 200, message: "✅ Server is running successfully 🚀" });
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 404, message: "Route not found 😢" });
});

// ✅ Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});

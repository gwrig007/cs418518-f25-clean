import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import user from "./route/user.js";
import advising from "./route/advising.js";

const app = express(); // ✅ define app first
const PORT = process.env.PORT || 8080;

app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5173",
      "https://oduadvisingportal.netlify.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // ✅ important if using cookies or auth
  })
);

// ✅ Also explicitly handle OPTIONS preflight requests
app.options("*", cors());


// ✅ Body parser
app.use(bodyParser.json());

// ✅ Optional logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ✅ Routes
app.use("/user", user);
app.use("/advising", advising); // ✅ move here after app is defined

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

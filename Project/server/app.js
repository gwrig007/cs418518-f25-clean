import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import user from "./route/user.js";

const app = express();

// ✅ Use Render’s assigned port, fallback to 8080 for local dev
const PORT = process.env.PORT || 8080;

// --- Middleware ---
app.use(bodyParser.json());

// ✅ Allow both local dev and deployed frontend
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",      // local dev
      "http://localhost:5173",      // Vite dev server
      "https://your-frontend-domain.netlify.app", // 🔁 replace with your deployed frontend if you have one
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

// --- Simple request logger ---
const myLogger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};
app.use(myLogger);

// --- Routes ---
app.use("/user", user); // mount user routes

app.get("/", (req, res) => {
  res.json({
    status: 200,
    message: "Server is running successfully 🚀",
  });
});

app.all("/test", (req, res) => {
  res.json({
    status: 200,
    message: "Response from ALL API",
  });
});

// --- Start server ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});

export default app;

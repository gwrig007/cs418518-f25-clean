import 'dotenv/config';
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import user from "./route/user.js";

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ CORS FIRST
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5173",
      "https://oduadvisingportal.netlify.app", // your Netlify site
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Then body parser
app.use(bodyParser.json());

// ✅ Logger (optional)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ✅ Routes
app.use("/user", user);

app.get("/", (req, res) => {
  res.json({ status: 200, message: "✅ Server is running successfully 🚀" });
});

app.use((req, res) => {
  res.status(404).json({ status: 404, message: "Route not found 😢" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});

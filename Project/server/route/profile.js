import { Router } from "express";
const profile = Router();

// GET /profile/profile - read useremail from session
profile.get("/", (req, res) => {
  if (req.session.user) {
    return res.json({
      status: 200,
      user: req.session.user,
      message: "Logged In",
    });
  } else {
    return res.status(401).json({
      status: 401,
      message: "Not logged in",
    });
  }
});

export default profile;
// server/middleware/validateSignup.js

export const validateSignup = (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  // Check for missing fields
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      status: 400,
      message: "All fields (first name, last name, email, password) are required.",
    });
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      status: 400,
      message: "Invalid email format.",
    });
  }

  // Check password strength
  if (password.length < 6) {
    return res.status(400).json({
      status: 400,
      message: "Password must be at least 6 characters long.",
    });
  }

  console.log("✅ Signup validation passed");
  next();
};

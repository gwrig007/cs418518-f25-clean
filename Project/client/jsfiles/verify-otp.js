document.addEventListener("DOMContentLoaded", () => {
  const BASE_URL = "https://cs418518-f25-clean.onrender.com";

  // Pull email waiting verification
  const pendingEmail = localStorage.getItem("pendingEmail");

  if (!pendingEmail) {
    alert("No pending email found. Please sign in again.");
    window.location.href = "signin.html";
    return;
  }

  const form = document.getElementById("otpForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const otp = document.getElementById("otp").value;

    try {
      const res = await fetch(`${BASE_URL}/user/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, otp }),
      });

      const data = await res.json();
      alert(data.message);

      if (!res.ok) return;

      // ============================================
      //  SUCCESS → Move pendingEmail → userEmail
      // ============================================
      localStorage.setItem("userEmail", pendingEmail);
      localStorage.removeItem("pendingEmail");

      // Redirect to home
      window.location.href = "home.html";

    } catch (err) {
      console.error(err);
      alert("Error verifying OTP. Please try again.");
    }
  });
});

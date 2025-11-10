document.addEventListener("DOMContentLoaded", () => {
  const email = localStorage.getItem("pendingEmail");

  if (!email) {
    alert("No pending email found. Please sign in again.");
    window.location.href = "signin.html";
    return;
  }

  const form = document.getElementById("otpForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const otp = document.getElementById("otp").value;

    try {
      const res = await fetch("http://localhost:8080/user/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      alert(data.message);

      if (res.ok) {
        // ✅ Save user info and redirect to home
        localStorage.setItem("email", email);
        localStorage.removeItem("pendingEmail"); // clear pending
        window.location.href = "home.html";
      }
    } catch (err) {
      console.error(err);
      alert("Error verifying OTP.");
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signinForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const res = await fetch("http://localhost:8080/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // ✅ Save email before redirect
        localStorage.setItem("pendingEmail", email);
        alert(data.message);
        window.location.href = "verify-otp.html";
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error signing in.");
    }
  });
});

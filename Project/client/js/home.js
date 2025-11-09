document.addEventListener("DOMContentLoaded", async () => {
  const email = localStorage.getItem("userEmail");

  if (!email) {
    alert("Please sign in again.");
    window.location.href = "signin.html";
    return;
  }

  try {
    // Fetch user data from backend
    const res = await fetch(`http://localhost:8080/user/profile?email=${email}`);
    const data = await res.json();

    if (res.ok) {
      const firstName = data.u_first_name || "";
      const lastName = data.u_last_name || "";
      document.getElementById(
        "welcomeMessage"
      ).textContent = `Welcome, ${firstName} ${lastName}!`;
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error(err);
    alert("Error loading user data.");
  }

  // Profile button
  document.getElementById("profileBtn").addEventListener("click", () => {
    window.location.href = "profile.html";
  });

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("userEmail");
    window.location.href = "signin.html";
  });
});


document.addEventListener("DOMContentLoaded", async () => {
  const email = localStorage.getItem("userEmail");

  if (!email) {
    alert("Please sign in again.");
    window.location.href = "signin.html";
    return;
  }

  try {
    // Fetch user data from backend (UPDATED URL)
    const res = await fetch(`https://cs418518-f25-clean.onrender.com/user/profile?email=${email}`);
    const data = await res.json();

    if (res.ok) {
      const firstName = data.u_first_name || "";
      const lastName = data.u_last_name || "";
      document.getElementById("welcomeMessage").textContent =
        `Welcome, ${firstName} ${lastName}!`;
    } else {
      console.error(data);
      alert("Unable to load profile.");
    }
  } catch (err) {
    console.error("Error loading user data:", err);
    alert("Error loading user data.");
  }

  // Navigate to Profile
  document.getElementById("profileBtn").addEventListener("click", () => {
    window.location.href = `profile.html?email=${email}`;
  });

  // Navigate to Course Advising Page
  document.getElementById("courseAdvisingBtn").addEventListener("click", () => {
    window.location.href = `classes.html?email=${email}`;
  });

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("userEmail");
    window.location.href = "signin.html";
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("profileForm");
  const email = localStorage.getItem("userEmail");

  if (!email) {
    alert("No user found. Please sign in again.");
    window.location.href = "signin.html";
    return;
  }

  // 🟦 Fetch current user info
  try {
    const res = await fetch(`http://localhost:8080/user/profile?email=${email}`);
    const data = await res.json();

    if (res.ok) {
      document.getElementById("firstName").value = data.firstName || "";
      document.getElementById("lastName").value = data.lastName || "";
      document.getElementById("email").value = data.email || "";
      document.getElementById("password").value = data.password || "";
    } else {
      alert(data.message || "Failed to load profile information.");
    }
  } catch (err) {
    console.error("Error fetching profile:", err);
    alert("Unable to fetch profile. Please try again later.");
  }

  // 🟩 Handle profile update submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const updatedProfile = {
      email: document.getElementById("email").value.trim(),
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      password: document.getElementById("password").value.trim(),
    };

    try {
      const res = await fetch("http://localhost:8080/user/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProfile),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Profile updated successfully!");
      } else {
        alert(data.message || "Failed to update profile.");
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("An error occurred while updating your profile.");
    }
  });
});

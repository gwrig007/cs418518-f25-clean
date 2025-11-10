document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotForm");

  if (!form) {
    console.error("Form with ID 'forgotForm' not found.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;

    try {
      const res = await fetch("http://localhost:8080/user/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      alert(data.message);
    } catch (err) {
      console.error(err);
      alert("Error sending reset email.");
    }
  });
});

// Get email from localStorage
const email = localStorage.getItem("pendingEmail");

if (!email) {
  console.error("No email found in localStorage!");
  alert("Please log in to submit advising forms.");
} else {
  const BASE_URL = "https://cs418518-f25-clean.onrender.com/advising";

  async function loadCourses() {
    try {
      const res = await fetch(`${BASE_URL}/current-courses?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const courses = await res.json();
      const container = document.getElementById("coursesContainer");
      if (!courses || courses.length === 0) {
        container.innerHTML = "<li>No courses found</li>";
      } else {
        container.innerHTML = courses.map(c => `<li>${c.courseName} (${c.courseCode})</li>`).join("");
      }
    } catch (err) {
      console.error("Error loading current courses:", err);
      document.getElementById("coursesContainer").innerHTML = "<li>Error loading courses</li>";
    }
  }

  // Call the function
  loadCourses();
}

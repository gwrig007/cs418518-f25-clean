// Get email from localStorage
const email = localStorage.getItem("pendingEmail");

if (!email) {
  console.error("No email found in localStorage!");
  alert("Please log in to see your courses.");
} else {
  const BASE_URL = "https://cs418518-f25-clean.onrender.com/advising";

  // Helper function to fetch data
  async function fetchData(endpoint) {
    try {
      const res = await fetch(`${BASE_URL}/${endpoint}?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status} for ${endpoint}`);
      }
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`Error loading ${endpoint}:`, err);
      return [];
    }
  }

  // Load current courses
  async function loadCurrentCourses() {
    const courses = await fetchData("current-courses");
    const container = document.getElementById("currentCoursesContainer");
    if (courses.length === 0) {
      container.innerHTML = "<li>No current courses found</li>";
    } else {
      container.innerHTML = courses.map(c => `<li>${c.courseName} (${c.courseCode})</li>`).join("");
    }
  }

  // Load taken courses
  async function loadTakenCourses() {
    const courses = await fetchData("taken-courses");
    const container = document.getElementById("takenCoursesContainer");
    if (courses.length === 0) {
      container.innerHTML = "<li>No taken courses found</li>";
    } else {
      container.innerHTML = courses.map(c => `<li>${c.courseName} (${c.courseCode})</li>`).join("");
    }
  }

  // Load forms
  async function loadForms() {
    const forms = await fetchData("forms");
    const container = document.getElementById("formsContainer");
    if (forms.length === 0) {
      container.innerHTML = "<li>No forms found</li>";
    } else {
      container.innerHTML = forms.map(f => `<li><a href="${f.url}" target="_blank">${f.name}</a></li>`).join("");
    }
  }

  // Load everything
  loadCurrentCourses();
  loadTakenCourses();
  loadForms();
}

// ============================
//     Setup
// ============================
const BASE_URL = "https://cs418518-f25-clean.onrender.com";

// Get email from URL first, then localStorage
let email = new URLSearchParams(window.location.search).get("email");

if (!email) {
  email = localStorage.getItem("userEmail");
}

if (!email) {
  email = localStorage.getItem("pendingEmail");
}

// still missing → redirect
if (!email) {
  alert("Error: Email not found. Please sign in again.");
  window.location.href = "signin.html";
}

const currentCoursesDiv = document.getElementById("currentCourses");
const takenCoursesDiv = document.getElementById("takenCourses");
const formsDiv = document.getElementById("formList");

document.getElementById("newFormBtn").onclick = () => {
  window.location.href = `advisingform.html?email=${email}`;
};

// Load all sections
loadCurrentCourses();
loadTakenCourses();
loadForms();


// ============================
//     Current Courses
// ============================
async function loadCurrentCourses() {
  try {
    const res = await fetch(`${BASE_URL}/advising/get-current-courses?email=${email}`);
    if (!res.ok) throw new Error("Failed to load current courses.");

    const data = await res.json();

    currentCoursesDiv.innerHTML = data.length
      ? data.map(c => `<p>${c}</p>`).join("")
      : "<p>No current courses found.</p>";

  } catch (error) {
    console.error(error);
    currentCoursesDiv.innerHTML = "<p>Error loading current courses.</p>";
  }
}

// ============================
//     Taken Courses
// ============================
async function loadTakenCourses() {
  try {
    const res = await fetch(`${BASE_URL}/advising/get-taken-courses?email=${email}`);
    if (!res.ok) throw new Error("Failed to load taken courses.");

    const data = await res.json();

    takenCoursesDiv.innerHTML = data.length
      ? data.map(c => `<p>${c}</p>`).join("")
      : "<p>No courses taken last term.</p>";

  } catch (error) {
    console.error(error);
    takenCoursesDiv.innerHTML = "<p>Error loading taken courses.</p>";
  }
}

// ============================
//     Advising Forms
// ============================
async function loadForms() {
  try {
    const res = await fetch(`${BASE_URL}/advising/get-advising-forms?email=${email}`);
    if (!res.ok) throw new Error("Failed to load advising forms.");

    const forms = await res.json();

    formsDiv.innerHTML = forms.length
      ? forms.map(f =>
          `<div class="form-card">
              <p><strong>Term:</strong> ${f.term}</p>
              <p><strong>Status:</strong> ${f.status}</p>
              <button onclick="window.location.href='advisingform.html?formId=${f._id}&email=${email}'">
                View / Edit
              </button>
           </div>`
        ).join("")
      : "<p>No advising forms found.</p>";

  } catch (error) {
    console.error(error);
    formsDiv.innerHTML = "<p>Error loading advising forms.</p>";
  }
}

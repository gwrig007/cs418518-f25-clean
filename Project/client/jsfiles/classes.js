// ============================
//     Page Setup
// ============================
const params = new URLSearchParams(window.location.search);
const email = params.get("email");

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
//     Load Current Courses
// ============================
async function loadCurrentCourses() {
  try {
    const res = await fetch(`/advising/get-current-courses?email=${email}`);
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
//     Load Taken Courses
// ============================
async function loadTakenCourses() {
  try {
    const res = await fetch(`/advising/get-taken-courses?email=${email}`);
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
//     Load Advising Forms
// ============================
async function loadForms() {
  try {
    const res = await fetch(`/advising/get-advising-forms?email=${email}`);
    if (!res.ok) throw new Error("Failed to load advising forms.");

    const forms = await res.json();

    formsDiv.innerHTML = forms.length
      ? forms.map(f =>
          `<div class="form-card">
              <p><strong>Term:</strong> ${f.currentTerm}</p>
              <p><strong>Status:</strong> ${f.status}</p>
              <button onclick="window.location.href='advisingform.html?email=${email}&formId=${f.id}'">
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

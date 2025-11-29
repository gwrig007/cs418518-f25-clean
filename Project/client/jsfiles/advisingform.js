// ============================
//     Load URL Params
// ============================
const params = new URLSearchParams(window.location.search);
const email = params.get("email");
const formId = params.get("formId");

document.getElementById("email").value = email;

// When editing, load existing form
if (formId) loadFormData();

// Always load course list
loadCourses();

// ============================
//     Load Courses
// ============================
async function loadCourses() {
  try {
    const res = await fetch(`/advising/get-current-courses?email=${email}`);
    if (!res.ok) throw new Error("Failed to load courses.");

    const courses = await res.json();

    const courseListDiv = document.getElementById("courseList");

    courseListDiv.innerHTML = courses.length
      ? courses.map(c =>
          `<label>
             <input type="checkbox" name="selectedCourses" value="${c}">
             ${c}
           </label><br>`
        ).join("")
      : "<p>No available courses.</p>";

  } catch (error) {
    console.error(error);
  }
}

// ============================
//     Load Existing Form Data
// ============================
async function loadFormData() {
  try {
    const res = await fetch(`/advising/get-form-by-id?formId=${formId}`);
    if (!res.ok) throw new Error("Failed to load form.");

    const form = await res.json();

    document.getElementById("formId").value = form.id;
    document.getElementById("currentTerm").value = form.currentTerm;
    document.getElementById("lastGPA").value = form.lastGPA;
    document.getElementById("status").value = form.status;

    // Pre-check selected courses AFTER course list loads
    setTimeout(() => {
      form.selectedCourses.forEach(course => {
        const box = document.querySelector(`input[value="${course}"]`);
        if (box) box.checked = true;
      });
    }, 300);

  } catch (error) {
    console.error(error);
  }
}

// ============================
//     Save Form
// ============================
document.getElementById("advisingForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const selectedCourses = [...document.querySelectorAll("input[name='selectedCourses']:checked")]
    .map(c => c.value);

  const body = {
    formId,
    email,
    currentTerm: document.getElementById("currentTerm").value,
    lastGPA: document.getElementById("lastGPA").value,
    status: document.getElementById("status").value,
    selectedCourses
  };

  try {
    const res = await fetch("/advising/save-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("Failed to save form");

    alert("Form saved successfully!");
    window.location.href = `classes.html?email=${email}`;

  } catch (error) {
    console.error("Error saving form:", error);
    alert("Error saving form.");
  }
});

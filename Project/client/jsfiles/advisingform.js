// ============================
//     Setup
// ============================
const BASE_URL = "https://cs418518-f25-clean.onrender.com";
const params = new URLSearchParams(window.location.search);
const formId = params.get("formId");

const email = localStorage.getItem("userEmail");
document.getElementById("email").value = email;

if (formId) loadFormData();
loadCourses();

// ============================
//     Load Courses
// ============================
async function loadCourses() {
  try {
    const res = await fetch(`${BASE_URL}/advising/get-current-courses?email=${email}`);
    const courses = await res.json();

    document.getElementById("courseList").innerHTML = courses.length
      ? courses.map(c => `
          <label>
            <input type="checkbox" name="selectedCourses" value="${c}"> ${c}
          </label><br>`
        ).join("")
      : "<p>No available courses.</p>";
  } catch (err) {
    console.error(err);
  }
}

// ============================
//     Load Existing Form
// ============================
async function loadFormData() {
  try {
    const res = await fetch(`${BASE_URL}/advising/get-form-by-id?formId=${formId}`);
    const form = await res.json();

    document.getElementById("formId").value = form._id;
    document.getElementById("currentTerm").value = form.term;
    document.getElementById("lastGPA").value = form.lastGpa;
    document.getElementById("status").value = form.status;

    setTimeout(() => {
      form.courses.forEach(course => {
        const box = document.querySelector(`input[value="${course}"]`);
        if (box) box.checked = true;
      });
    }, 300);
  } catch (err) {
    console.error(err);
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
    term: document.getElementById("currentTerm").value,
    lastGpa: document.getElementById("lastGPA").value,
    status: document.getElementById("status").value,
    courses: selectedCourses
  };

  try {
    const res = await fetch(`${BASE_URL}/advising/save-form`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("Save failed");

    alert("Form saved!");
    window.location.href = "classes.html";

  } catch (err) {
    console.error(err);
    alert("Error saving form.");
  }
});

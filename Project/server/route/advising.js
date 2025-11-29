const API = "https://cs418518-f25-clean.onrender.com/advising";

const urlParams = new URLSearchParams(window.location.search);
const email = urlParams.get("email");
const advisingId = urlParams.get("id");

if (!email) {
    alert("Missing email. Please sign in again.");
    window.location.href = "signin.html";
}

document.addEventListener("DOMContentLoaded", () => {
    if (advisingId) {
        loadExistingForm();
        loadCourses();
    }
});

// ------------------------------
// Load existing advising form
// ------------------------------
async function loadExistingForm() {
    try {
        const res = await fetch(`${API}/history?email=${email}`);
        const forms = await res.json();

        const thisForm = forms.find(f => String(f.id) === String(advisingId));
        if (!thisForm) return;

        document.getElementById("lastTerm").value = thisForm.last_term;
        document.getElementById("lastGpa").value = thisForm.last_gpa;
        document.getElementById("statusText").innerText = thisForm.status;

    } catch (err) {
        console.error("Error loading form:", err);
    }
}

// ------------------------------
// Load advising courses for this form
// ------------------------------
async function loadCourses() {
    if (!advisingId) return;

    const container = document.getElementById("courseList");
    container.innerHTML = "Loading...";

    try {
        const res = await fetch(`${API}/courses?advising_id=${advisingId}`);
        const courses = await res.json();

        if (!courses.length) {
            container.innerHTML = "<p>No courses added yet.</p>";
            return;
        }

        container.innerHTML = courses
            .map(c => `
                <div class="course-item">
                    <strong>${c.course_level}</strong> — ${c.course_name}
                    <span class="status-tag">${c.status}</span>
                </div>
            `)
            .join("");

    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error loading courses.</p>";
    }
}

// ------------------------------
// Create new advising form
// ------------------------------
async function createForm() {
    const last_term = document.getElementById("lastTerm").value;
    const last_gpa = document.getElementById("lastGpa").value;

    if (!last_term) return alert("Enter last term");

    try {
        const res = await fetch(`${API}/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, last_term, last_gpa })
        });

        const data = await res.json();

        if (data.success) {
            window.location.href = `advisingform.html?id=${data.advising_id}&email=${email}`;
        } else {
            alert("Failed to create form.");
        }

    } catch (err) {
        console.error(err);
    }
}

// ------------------------------
// Add a course
// ------------------------------
async function addCourse() {
    const course_level = document.getElementById("courseLevel").value;
    const course_name = document.getElementById("courseName").value;
    const current_term = document.getElementById("currentTerm").value;

    if (!advisingId) return alert("No advising form loaded.");

    try {
        const res = await fetch(`${API}/add-course`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                advising_id: advisingId,
                course_level,
                course_name,
                current_term
            })
        });

        const data = await res.json();
        if (data.success) {
            loadCourses();
            document.getElementById("courseLevel").value = "";
            document.getElementById("courseName").value = "";
            document.getElementById("currentTerm").value = "";
        }

    } catch (err) {
        console.error(err);
    }
}

// ------------------------------
// Button bindings
// ------------------------------
document.getElementById("saveFormBtn")?.addEventListener("click", createForm);
document.getElementById("addCourseBtn")?.addEventListener("click", addCourse);

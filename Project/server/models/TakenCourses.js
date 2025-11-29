const mongoose = require("mongoose");

const TakenCoursesSchema = new mongoose.Schema({
    email: { type: String, required: true },
    term: { type: String, required: true },
    courses: { type: [String], required: true }
});

module.exports = mongoose.model("TakenCourses", TakenCoursesSchema);

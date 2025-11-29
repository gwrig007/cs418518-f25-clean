const mongoose = require("mongoose");

const AdvisingSchema = new mongoose.Schema({
    email: { type: String, required: true },
    term: { type: String, required: true },
    lastGpa: { type: String, required: true },
    courses: { type: [String], required: true },
    status: { type: String, default: "Pending" }
}, { timestamps: true });

module.exports = mongoose.model("Advising", AdvisingSchema);

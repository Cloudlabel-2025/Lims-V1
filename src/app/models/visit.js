import mongoose from "mongoose";

const visitSchema = new mongoose.Schema({
    visitId: {
        type: String,
        unique: true,
    },
    patientId: {
        type: String,
        ref: "Patient",
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    diagnosis: {
        type: String,
        required: true
    },
    prescription: [{
        type: String,
        required: true
    }],
    reports: [{
        type: String,
        required: true
    }]

});

export function getVisitModel(connection = mongoose) {
    return connection.models.Visit || connection.model("Visit", visitSchema);
}

const Visit = getVisitModel();
export default Visit;

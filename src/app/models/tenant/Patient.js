import mongoose from "mongoose";

function getCounterModel(connection) {
    return (
        connection.models.Counter ||
        connection.model(
            "Counter",
            new mongoose.Schema({
                name: { type: String, required: true, unique: true },
                seq: { type: Number, default: 0 }
            })
        )
    );
}

const patientSchema = new mongoose.Schema({
    patientId: {
        type: String,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 20,
        match: /^[A-Za-z .]+$/ // only letters, spaces, and periods
    },
    dob: {
        type: Date,
        required: true
    },
    age: {
        type: Number,
        required: true,
        min: [1, "Age must be at least 1"],
        validate: {
            validator: Number.isInteger,
            message: "Age must be an integer"
        },
    },
    gender: {
        type: String,
        required: true,
        enum: ["Male", "Female", "Other"]
    },
    genderIdentity: {
        type: String,
        required: function () { return this.gender === "Other"; },
        enum: ["Transwomen", "Transman"]
    },
    phone: {
        type: String,
        required: true,
        validate: {
            validator: (v) => /^\d{10}$/.test(v),
            message: "Phone must be exactly 10 digits"
        }
    },
    address: {
        type: String,
        required: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (v) {
                return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: "Invalid email format"
        }
    },
    uhId: {
        type: String,
        validate: {
            validator: (v) => !v || /^\d{14}$/.test(v),
            message: "UH ID must be exactly 14 digits"
        }
    },

    collectionTime: {
        type: Date
    },
    receivedTime: {
        type: Date,
        required: true,
        validate: {
            validator: function (value) {
                if (!this.collectionTime) return true;
                return value >= this.collectionTime;
            },
            message: "Received time must be greater than or equal to collection time"
        }
    },

    refDoctorName: {
        type: String
    },
    reportType: {
        type: String,
        enum: ["Hand", "Digital"],
        default: "Hand"
    },
    barcode: {
        type: String,
        unique: true,
        sparse: true
    }
}, { timestamps: true });

patientSchema.index({ name: "text", patientId: 1, phone: 1 });

//  AUTO GENERATE PATIENT ID //
patientSchema.pre("save", async function () {
    if (!this.patientId) {
        const Counter = getCounterModel(this.constructor.db);
        const counter = await Counter.findOneAndUpdate(
            { name: "patientId" },
            { $inc: { seq: 1 } },
            { returnDocument: "after", upsert: true }
        );

        this.patientId = `UDHIRAM-${String(counter.seq).padStart(8, "0")}`;
    }
});

export function getPatientModel(connection = mongoose) {
    return connection.models.Patient || connection.model("Patient", patientSchema);
}

const Patient = getPatientModel();
export default Patient;

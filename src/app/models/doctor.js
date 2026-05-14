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

const doctorSchema = new mongoose.Schema({
    doctorId: {
        type: String,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 50,
        match: /^[A-Za-z .]+$/
    },
    speciality: {
        type: String,
        required: true
    },
    degree: {
        type: String,
        required: true
    },
    experience: {
        type: Number,
        required: true,
        min: 0
    },
    mciNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: (v) => /^\d{10}$/.test(v),
            message: "Phone must be exactly 10 digits"
        }
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
    clinicName: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    clinicAddress: {
        type: String,
        required: true
    },
    commission: {
        type: Number,
        default: 0,
        min: [0, "Commission must be at least 0%"],
        max: [40, "Commission cannot exceed 40%"]
    },
    doctorType: {
        type: String,
        enum: ["Regular", "Investor"],
        default: "Regular"
    },
    status: {
        type: String,
        enum: ["Active", "On Leave", "Inactive"],
        default: "Active"
    },
    pendingPayout: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

doctorSchema.index({ name: "text", doctorId: 1, phone: 1, mciNumber: 1 });

doctorSchema.pre("save", async function () {
    if (!this.doctorId) {
        const Counter = getCounterModel(this.constructor.db);
        const counter = await Counter.findOneAndUpdate(
            { name: "doctorId" },
            { $inc: { seq: 1 } },
            { returnDocument: "after", upsert: true }
        );
        this.doctorId = `UTHDR-${String(counter.seq).padStart(6, "0")}`;
    }
});

export function getDoctorModel(connection = mongoose) {
    return connection.models.Doctor || connection.model("Doctor", doctorSchema);
}

const Doctor = getDoctorModel();
export default Doctor;

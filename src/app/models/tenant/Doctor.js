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
        required: true,
        validate: {
            validator: (v) => {
                const value = String(v || "");
                return !/https?:\/\/|www\.|\.[a-z]{2,}\b/i.test(value) && /^[A-Za-z .,/&()-]+$/.test(value);
            },
            message: "Only qualification text is allowed"
        }
    },
    experience: {
        type: Number,
        required: true,
        min: [0, "Experience must be at least 0 years"],
        max: [80, "Experience cannot exceed 80 years"],
        validate: {
            validator: Number.isInteger,
            message: "Experience must be a whole number"
        }
    },
    mciNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        validate: {
            validator: (v) => {
                const cleaned = String(v || "").trim();
                if (/https?:\/\//i.test(cleaned) || /www\./i.test(cleaned)) return false;
                return /^[A-Z]{2,}[A-Z\s/-]*\d[\d\s/-]*$/.test(cleaned.toUpperCase());
            },
            message: "Enter a valid MCI registration number"
        }
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
        required: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (v) {
                return /^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);
            },
            message: "Invalid email format"
        }
    },
    clinicName: {
        type: String,
        required: true,
        validate: {
            validator: (v) => {
                const cleaned = String(v || "").trim();
                if (/https?:\/\/|www\./i.test(cleaned)) return false;
                return /^[A-Za-z][A-Za-z0-9 .&'-]*[A-Za-z0-9]$|^[A-Za-z]$/.test(cleaned);
            },
            message: "Enter a valid clinic name"
        }
    },
    location: {
        type: String,
        required: true,
        validate: {
            validator: (v) => {
                const cleaned = String(v || "").trim();
                if (/https?:\/\/|www\./i.test(cleaned)) return false;
                return /^[A-Za-z][A-Za-z0-9 .,'-]*[A-Za-z0-9.]$|^[A-Za-z]$/.test(cleaned);
            },
            message: "Enter a valid location"
        }
    },
    clinicAddress: {
        type: String,
        required: true,
        validate: {
            validator: (v) => {
                const cleaned = String(v || "").trim();
                if (/https?:\/\/|www\./i.test(cleaned)) return false;
                const specialChars = (cleaned.match(/[^A-Za-z0-9 .,/#-]/g) || []).length;
                if (specialChars / cleaned.length > 0.5) return false;
                return cleaned.length >= 5;
            },
            message: "Enter a valid practice address"
        }
    },
    gender: {
        type: String,
        enum: ["Male", "Female", "Other"],
        default: "Male"
    },
    genderIdentity: {
        type: String,
        enum: ["Transwomen", "Transman"],
    },
    commission: {
        type: Number,
        default: 0,
        min: [0, "Commission must be at least 0%"],
        max: [40, "Commission cannot exceed 40%"],
        validate: {
            validator: (v) => v === 0 || (Number.isFinite(v) && v >= 0 && v <= 40),
            message: "Commission must be between 0 and 40%"
        }
    },
    doctorType: {
        type: String,
        enum: ["Non-Investor", "Investor"],
        default: "Non-Investor"
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
        const prefix = this.constructor.doctorPrefix || "DR";
        this.doctorId = `${prefix}DR-${String(counter.seq).padStart(8, "0")}`;
    }
});

export function getDoctorModel(connection = mongoose, options = {}) {
    if (connection.models.Doctor) {
        if (options.doctorPrefix) {
            connection.models.Doctor.doctorPrefix = options.doctorPrefix;
        }
        return connection.models.Doctor;
    }

    const Doctor = connection.model("Doctor", doctorSchema);
    Doctor.doctorPrefix = options.doctorPrefix || "DR";
    return Doctor;
}

const Doctor = getDoctorModel();
export default Doctor;

import mongoose from "mongoose";

function getCounterModel(connection) {
  return (
    connection.models.Counter ||
    connection.model(
      "Counter",
      new mongoose.Schema({
        name: { type: String, required: true, unique: true },
        seq: { type: Number, default: 0 },
      })
    )
  );
}

async function getNextSequence(connection, name, session) {
  const Counter = getCounterModel(connection);
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, session }
  );

  return counter.seq;
}

const JournalLineSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

export const JournalEntrySchema = new mongoose.Schema(
  {
    entryNumber: { type: String, unique: true, immutable: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    sourceType: {
      type: String,
      enum: ["billing", "payment", "refund", "commission", "expense", "manual"],
      required: true,
      index: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
    lines: {
      type: [JournalLineSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: "Journal entry must have at least two lines",
      },
    },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    postedAt: { type: Date, default: Date.now, immutable: true },
    isReversed: { type: Boolean, default: false, index: true },
    reversalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
  },
  { timestamps: true }
);

JournalEntrySchema.index({ tenantId: 1, entryNumber: 1 }, { unique: true });
JournalEntrySchema.index({ tenantId: 1, sourceType: 1, sourceId: 1 });

JournalEntrySchema.pre("validate", function validateBalancedEntry(next) {
  const totals = (this.lines || []).reduce(
    (sum, line) => ({
      debit: sum.debit + Number(line.debit || 0),
      credit: sum.credit + Number(line.credit || 0),
    }),
    { debit: 0, credit: 0 }
  );
  const hasInvalidLine = (this.lines || []).some((line) => {
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    return (debit > 0 && credit > 0) || (debit === 0 && credit === 0);
  });

  if (hasInvalidLine) {
    next(new Error("Each journal line must contain either debit or credit"));
    return;
  }

  if (Math.round(totals.debit * 100) !== Math.round(totals.credit * 100)) {
    next(new Error("Journal entry debits and credits must balance"));
    return;
  }

  next();
});

JournalEntrySchema.pre("save", async function generateEntryNumber() {
  if (this.entryNumber) return;

  const seq = await getNextSequence(this.constructor.db, "journalEntryNumber", this.$session());
  this.entryNumber = `JE-${String(seq).padStart(8, "0")}`;
});

function blockMutation(next) {
  next(new Error("Posted journal entries are immutable; post a reversal entry instead"));
}

JournalEntrySchema.pre("updateOne", blockMutation);
JournalEntrySchema.pre("findOneAndUpdate", blockMutation);
JournalEntrySchema.pre("deleteOne", blockMutation);
JournalEntrySchema.pre("findOneAndDelete", blockMutation);

export function getJournalEntryModel(connection = mongoose) {
  return connection.models.JournalEntry || connection.model("JournalEntry", JournalEntrySchema);
}

const JournalEntry = getJournalEntryModel();
export default JournalEntry;

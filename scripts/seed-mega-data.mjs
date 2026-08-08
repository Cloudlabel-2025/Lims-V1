import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import { getLabModel } from "../src/app/models/master/Lab.js";
import { seedDefaultTests } from "../src/app/lib/test-seeder.js";

// Import relative models directly to avoid Next.js @/app alias path resolution issues outside next runtime
import { getPatientModel } from "../src/app/models/tenant/Patient.js";
import { getDoctorModel } from "../src/app/models/tenant/Doctor.js";
import { getBillingRecordModel } from "../src/app/models/tenant/BillingRecord.js";
import { getSampleModel } from "../src/app/models/tenant/Sample.js";
import { getTestReportModel } from "../src/app/models/tenant/TestReport.js";
import { getPaymentReceiptModel } from "../src/app/models/tenant/PaymentReceipt.js";
import { getTestDefinitionModel } from "../src/app/models/tenant/TestDefinition.js";
import { getAccountModel } from "../src/app/models/tenant/Account.js";
import { getJournalEntryModel } from "../src/app/models/tenant/JournalEntry.js";
import { getRoleModel } from "../src/app/models/tenant/Role.js";
import { getUserModel, getNextAvailableUserId } from "../src/app/models/tenant/User.js";

const rootDir = process.cwd();

function loadLocalEnv() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}

const systemChartOfAccounts = [
  { code: "1001", name: "Cash", type: "asset", subtype: "cash" },
  { code: "1002", name: "Bank", type: "asset", subtype: "bank" },
  { code: "1100", name: "Accounts Receivable - Patients", type: "asset", subtype: "accounts-receivable" },
  { code: "1101", name: "Accounts Receivable - Corporate", type: "asset", subtype: "corporate-receivable" },
  { code: "2001", name: "Accounts Payable - Referral Doctors", type: "liability", subtype: "referral-payable" },
  { code: "2002", name: "Accounts Payable - Vendors", type: "liability", subtype: "vendor-payable" },
  { code: "2100", name: "Tax Payable (GST/VAT)", type: "liability", subtype: "tax-payable" },
  { code: "3001", name: "Owner Equity", type: "equity", subtype: "owner-equity" },
  { code: "4001", name: "Lab Revenue - Tests", type: "revenue", subtype: "test-revenue" },
  { code: "4002", name: "Lab Revenue - Packages", type: "revenue", subtype: "package-revenue" },
  { code: "4003", name: "Discounts Given", type: "revenue", subtype: "discounts-given" },
  { code: "5001", name: "Reagent Expense", type: "expense", subtype: "reagent-expense" },
  { code: "5002", name: "Staff Expense", type: "expense", subtype: "staff-expense" },
  { code: "5003", name: "Equipment Expense", type: "expense", subtype: "equipment-expense" },
  { code: "5004", name: "Overhead Expense", type: "expense", subtype: "overhead-expense" },
  { code: "5005", name: "Referral Commission Expense", type: "expense", subtype: "referral-commission-expense" },
];

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function accountBalanceDelta(accountType, debit, credit) {
  return ["asset", "expense"].includes(accountType)
    ? roundMoney(debit - credit)
    : roundMoney(credit - debit);
}

async function localPostJournalEntry(tenantConnection, payload, session) {
  const Account = getAccountModel(tenantConnection);
  const JournalEntry = getJournalEntryModel(tenantConnection);
  const accountIds = payload.lines.map((line) => line.accountId);
  const accounts = await Account.find({ tenantId: payload.tenantId, _id: { $in: accountIds } }).session(session);
  const accountsById = new Map(accounts.map((account) => [String(account._id), account]));

  const [journalEntry] = await JournalEntry.create(
    [
      {
        date: payload.date || new Date(),
        description: payload.description,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        lines: payload.lines.map((line) => ({
          accountId: line.accountId,
          debit: roundMoney(line.debit),
          credit: roundMoney(line.credit),
        })),
        tenantId: payload.tenantId,
        postedBy: payload.postedBy,
        postedAt: new Date(),
      },
    ],
    { session }
  );

  for (const line of journalEntry.lines) {
    const account = accountsById.get(String(line.accountId));
    const delta = accountBalanceDelta(account.type, line.debit, line.credit);

    await Account.updateOne(
      { _id: account._id, tenantId: payload.tenantId },
      { $inc: { balance: delta } },
      { session }
    );
  }

  return journalEntry;
}

async function main() {
  loadLocalEnv();

  const masterUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
  if (!masterUri) {
    throw new Error("MASTER_MONGODB_URI or MONGODB_URI is required");
  }

  const masterConnection = await mongoose
    .createConnection(masterUri, {
      dbName: "CMS",
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();

  console.log("Connected to master database.");

  const Lab = getLabModel(masterConnection);
  const lab = await Lab.findOne({ tenantId: "mega" }).select("+dbConnectionString");
  if (!lab) {
    console.error("Lab 'mega' not found in master database.");
    await masterConnection.close();
    process.exit(1);
  }

  console.log(`Connecting to tenant DB for '${lab.name}' (${lab.tenantId})...`);
  const tenantConnection = await mongoose
    .createConnection(lab.dbConnectionString, {
      dbName: lab.dbName,
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();

  try {
    // Resolve models on tenant connection
    const Patient = getPatientModel(tenantConnection);
    const Doctor = getDoctorModel(tenantConnection);
    const BillingRecord = getBillingRecordModel(tenantConnection);
    const Sample = getSampleModel(tenantConnection);
    const TestReport = getTestReportModel(tenantConnection);
    const PaymentReceipt = getPaymentReceiptModel(tenantConnection);
    const TestDefinition = getTestDefinitionModel(tenantConnection);
    const Account = getAccountModel(tenantConnection);
    const User = getUserModel(tenantConnection);
    const Role = getRoleModel(tenantConnection);
    const Counter = tenantConnection.models.Counter || tenantConnection.model("Counter", new mongoose.Schema({ name: String, seq: Number }));

    // 1. Seed 150+ tests globally for this lab
    console.log("Seeding test categories and definitions...");
    const seedResult = await seedDefaultTests(tenantConnection);
    console.log(`Seeded tests: ${seedResult.categoriesSeeded} categories, ${seedResult.testsSeeded} new tests.`);

    // 2. Ensure Chart of Accounts is seeded
    console.log("Seeding chart of accounts...");
    await Account.bulkWrite(
      systemChartOfAccounts.map((account) => ({
        updateOne: {
          filter: { tenantId: lab.tenantId, code: account.code },
          update: { $setOnInsert: { ...account, tenantId: lab.tenantId, isSystem: true, balance: 0 } },
          upsert: true,
        },
      }))
    );

    // Get standard accounting accounts
    const cashAccount = await Account.findOne({ tenantId: lab.tenantId, code: "1001" });
    const bankAccount = await Account.findOne({ tenantId: lab.tenantId, code: "1002" });
    const receivableAccount = await Account.findOne({ tenantId: lab.tenantId, code: "1100" });
    const revenueAccount = await Account.findOne({ tenantId: lab.tenantId, code: "4001" });
    const discountAccount = await Account.findOne({ tenantId: lab.tenantId, code: "4003" });
    const taxPayableAccount = await Account.findOne({ tenantId: lab.tenantId, code: "2100" });

    // Clear existing patient/doctor/billing records to start fresh
    console.log("Cleaning up old patient, doctor, and billing data for clean seeding...");
    await Promise.all([
      Patient.deleteMany({}),
      Doctor.deleteMany({}),
      BillingRecord.deleteMany({}),
      Sample.deleteMany({}),
      TestReport.deleteMany({}),
      PaymentReceipt.deleteMany({}),
      Counter.deleteMany({ name: { $in: ["patientId", "doctorId", "billingRecordId", "sampleId", "testReportId"] } })
    ]);

    // 3. Seed 3 Doctors (including one Investor)
    console.log("Seeding 3 doctors...");
    const doctorsData = [
      {
        name: "Dr. Rajesh Kumar",
        speciality: "Cardiology",
        degree: "MD DM",
        experience: 15,
        mciNumber: "MCI-77889",
        phone: "9876543210",
        email: "rajesh@gmail.com",
        clinicName: "Rajesh Heart Clinic",
        location: "Chennai",
        clinicAddress: "12, Heart Care Road, Chennai",
        commission: 15,
        doctorType: "Investor",
        status: "Active"
      },
      {
        name: "Dr. Anita Sharma",
        speciality: "Pediatrics",
        degree: "MBBS DCH",
        experience: 10,
        mciNumber: "MCI-44552",
        phone: "9876543211",
        email: "anita@gmail.com",
        clinicName: "Anita Child Care",
        location: "Chennai",
        clinicAddress: "45, Kids Paradise Street, Chennai",
        commission: 10,
        doctorType: "Non-Investor",
        status: "Active"
      },
      {
        name: "Dr. Sunil Varma",
        speciality: "General Medicine",
        degree: "MD Medicine",
        experience: 12,
        mciNumber: "MCI-33441",
        phone: "9876543212",
        email: "sunil@gmail.com",
        clinicName: "Varma Clinic",
        location: "Chennai",
        clinicAddress: "88, Central Bazar Road, Chennai",
        commission: 0,
        doctorType: "Non-Investor",
        status: "Active"
      }
    ];

    const doctors = [];
    for (const dData of doctorsData) {
      const doc = new Doctor(dData);
      await doc.save();
      doctors.push(doc);
    }
    console.log(`Successfully seeded ${doctors.length} doctors.`);

    let systemUser = await User.findOne({ email: "system@gmail.com" });
    if (!systemUser) {
      const adminRole = await Role.findOne({ name: "Administrator" });
      const userId = await getNextAvailableUserId(User);
      systemUser = await User.create({
        userId,
        firstName: "System",
        lastName: "Administrator",
        email: "system@gmail.com",
        phone: "9999999999",
        passwordHash: "dummy",
        role: adminRole ? adminRole._id : new mongoose.Types.ObjectId(),
        status: "active"
      });
    }

    // 4. Seed 5 Patients
    console.log("Seeding 5 patients...");
    const patientsData = [
      {
        name: "Kavin",
        dob: new Date("2002-05-15"),
        age: 24,
        gender: "Male",
        phone: "9578123456",
        address: "Nandhagopal kovil street,cumbum",
        email: "kavin@gmail.com",
        refDoctorName: "Dr. Rajesh Kumar"
      },
      {
        name: "Priya Patel",
        dob: new Date("1996-08-20"),
        age: 30,
        gender: "Female",
        phone: "9812345670",
        address: "123 MG Road, Mumbai",
        email: "priya@gmail.com",
        refDoctorName: "Dr. Anita Sharma"
      },
      {
        name: "Aarav Shah",
        dob: new Date("1981-11-10"),
        age: 45,
        gender: "Male",
        phone: "9812345671",
        address: "456 Park Avenue, Delhi",
        email: "aarav@gmail.com",
        refDoctorName: "Dr. Sunil Varma"
      },
      {
        name: "Meera Nair",
        dob: new Date("1966-02-05"),
        age: 60,
        gender: "Female",
        phone: "9812345672",
        address: "789 Lake View, Bangalore",
        email: "meera@gmail.com",
        refDoctorName: "Dr. Rajesh Kumar"
      },
      {
        name: "Rohan Das",
        dob: new Date("2014-04-12"),
        age: 12,
        gender: "Male",
        phone: "9812345673",
        address: "101 River Side, Kolkata",
        email: "rohan@gmail.com",
        refDoctorName: "Self"
      }
    ];

    const patients = [];
    for (const pData of patientsData) {
      const pat = new Patient(pData);
      await pat.save();
      patients.push(pat);
    }
    console.log(`Successfully seeded ${patients.length} patients.`);

    // Retrieve active test definitions
    const testDefs = await TestDefinition.find({ status: "active" }).populate("category", "name").lean();
    if (testDefs.length === 0) {
      throw new Error("No active test definitions found to associate with bills!");
    }

    // 5. Seed 50 Bills distributed over the last 30 days
    console.log("Seeding 50 billing records and generating accounts transaction history...");
    const numBills = 50;
    const now = new Date();

    for (let i = 1; i <= numBills; i++) {
      const patient = patients[i % patients.length];
      const referralDoctor = i % 4 === 0 ? null : doctors[i % doctors.length]; // 75% referred by doctor, 25% self

      // Select 1 to 3 random tests
      const numTests = Math.floor(Math.random() * 3) + 1;
      const selectedTests = [];
      const usedIndices = new Set();
      while (selectedTests.length < numTests) {
        const randIndex = Math.floor(Math.random() * testDefs.length);
        if (!usedIndices.has(randIndex)) {
          usedIndices.add(randIndex);
          selectedTests.push(testDefs[randIndex]);
        }
      }

      let subtotalAmount = 0;
      const billingItems = selectedTests.map((test) => {
        const price = test.price || 200;
        subtotalAmount += price;
        return {
          testDefinition: test._id,
          testSnapshot: {
            testId: test.testId,
            name: test.name,
            code: test.code,
            categoryName: test.category?.name || "General",
            sampleType: test.sampleType || "Blood",
            price: price
          },
          status: "reported"
        };
      });

      // Apply random discount & tax
      const discountPercent = Math.random() < 0.3 ? (Math.random() < 0.5 ? 10 : 20) : 0;
      const discountAmount = Math.round((subtotalAmount * discountPercent) / 100);
      const taxAmount = Math.round(((subtotalAmount - discountAmount) * 5) / 100);
      const totalAmount = subtotalAmount - discountAmount + taxAmount;

      const commissionRate = referralDoctor?.commission || 0;
      const commissionAmount = Math.round((totalAmount * commissionRate) / 100);

      // Distribute creation date across the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const billDate = new Date();
      billDate.setDate(now.getDate() - daysAgo);

      // Determine statuses
      const randPay = Math.random();
      let billingStatus = "paid";
      let paidAmount = totalAmount;
      if (randPay < 0.1) {
        billingStatus = "unpaid";
        paidAmount = 0;
      } else if (randPay < 0.2) {
        billingStatus = "partial";
        paidAmount = Math.round(totalAmount / 2);
      }

      const isCompleted = Math.random() < 0.85;
      const status = isCompleted ? "completed" : "in-progress";

      const bill = new BillingRecord({
        patient: patient._id,
        items: billingItems,
        referralDoctor: referralDoctor?._id,
        tenantId: lab.tenantId,
        subtotalAmount,
        discountAmount,
        taxAmount,
        totalAmount,
        commissionAmount,
        billingStatus,
        invoiceStatus: "confirmed",
        priority: Math.random() < 0.15 ? "urgent" : "routine",
        notes: `Sample seed billing record #${i}`,
        createdBy: systemUser.email,
        status,
        createdAt: billDate,
        updatedAt: billDate
      });

      await bill.save();

      // Post invoice journal entry
      const invoiceLines = [
        { accountId: receivableAccount._id, debit: totalAmount, credit: 0 },
        { accountId: revenueAccount._id, debit: 0, credit: subtotalAmount },
      ];
      if (discountAmount > 0) {
        invoiceLines.push({ accountId: discountAccount._id, debit: discountAmount, credit: 0 });
      }
      if (taxAmount > 0) {
        invoiceLines.push({ accountId: taxPayableAccount._id, debit: 0, credit: taxAmount });
      }

      const invoiceJournalEntry = await localPostJournalEntry(tenantConnection, {
        tenantId: lab.tenantId,
        postedBy: systemUser._id,
        sourceType: "billing",
        sourceId: bill._id,
        description: `Invoice confirmed for ${bill.billId}`,
        lines: invoiceLines,
        date: billDate
      });

      bill.invoiceJournalEntryId = invoiceJournalEntry._id;

      // Handle payments
      if (paidAmount > 0) {
        const paymentReceipt = new PaymentReceipt({
          invoiceId: bill._id,
          patientId: patient._id,
          amount: paidAmount,
          method: Math.random() < 0.5 ? "cash" : "upi",
          receivedAt: billDate,
          receivedBy: systemUser._id,
          tenantId: lab.tenantId
        });
        await paymentReceipt.save();

        const paymentLines = [
          { accountId: cashAccount._id, debit: paidAmount, credit: 0 },
          { accountId: receivableAccount._id, debit: 0, credit: paidAmount }
        ];

        await localPostJournalEntry(tenantConnection, {
          tenantId: lab.tenantId,
          postedBy: systemUser._id,
          sourceType: "payment",
          sourceId: paymentReceipt._id,
          description: `Payment received for ${bill.billId}`,
          lines: paymentLines,
          date: billDate
        });

        bill.paymentReceiptIds = [paymentReceipt._id];
        bill.firstPaymentDate = billDate;
        bill.lastPaymentDate = billDate;
        bill.lastPaymentAmount = paidAmount;
        bill.lastPaymentMethod = paymentReceipt.method;
        bill.lastPaymentModes = [paymentReceipt.method];
      }

      await bill.save();

      // Create Samples and TestReports for each billing item
      for (const item of bill.items) {
        const sample = new Sample({
          billingRecord: bill._id,
          billingItemId: item._id,
          patient: patient._id,
          testDefinition: item.testDefinition,
          testSnapshot: item.testSnapshot,
          sampleType: item.testSnapshot.sampleType,
          status: isCompleted ? "released" : "collected",
          collectionTime: billDate,
          receivedAt: billDate,
          receivedBy: "System Collector",
          createdAt: billDate,
          updatedAt: billDate
        });
        await sample.save();

        item.status = isCompleted ? "reported" : "sample-collected";

        // Create Report
        const reportParams = selectedTests.find(t => String(t._id) === String(item.testDefinition))?.parameters || [];
        const reportResults = reportParams.map((p) => {
          const valRange = (p.normalMax || 100) - (p.normalMin || 0);
          const value = Math.round(((p.normalMin || 10) + (valRange * (0.2 + Math.random() * 0.6))) * 10) / 10;
          return {
            key: p.name.toLowerCase().replace(/\s+/g, ""),
            name: p.name,
            unit: p.unit,
            normalMin: p.normalMin,
            normalMax: p.normalMax,
            required: true,
            value: value,
            textValue: String(value),
            flag: "normal"
          };
        });

        const report = new TestReport({
          patient: patient._id,
          testDefinition: item.testDefinition,
          sample: sample._id,
          sampleId: sample.sampleId,
          billingRecord: bill._id,
          testSnapshot: item.testSnapshot,
          results: reportResults,
          remarks: isCompleted ? "All parameters fall within expected clinical biological reference ranges." : "",
          status: isCompleted ? "released" : "draft",
          enteredBy: "system@gmail.com",
          version: 1,
          reviewedAt: isCompleted ? billDate : null,
          reviewedBy: isCompleted ? "Dr. Rajesh Kumar (Cardiologist)" : null,
          approvedAt: isCompleted ? billDate : null,
          approvedBy: isCompleted ? "Dr. Rajesh Kumar (Cardiologist)" : null,
          releasedAt: isCompleted ? billDate : null,
          releasedBy: isCompleted ? "Dr. Rajesh Kumar (Cardiologist)" : null,
          createdAt: billDate,
          updatedAt: billDate
        });
        await report.save();
      }

      await bill.save();
    }

    console.log(`Successfully seeded ${numBills} billing records, samples, test reports, and financial transactions.`);
  } catch (error) {
    console.error("Error seeding tenant database:", error);
  } finally {
    await tenantConnection.close();
  }

  await masterConnection.close();
  console.log("Master connection closed. Seeding completed successfully!");
}

main().catch((error) => {
  console.error("Master Seeding failed:", error.message);
  process.exitCode = 1;
});

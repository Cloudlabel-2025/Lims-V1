import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { nextJsonError } from "@/app/lib/api-response";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { seedDefaultInventory } from "@/app/lib/inventory-seeder";
import { seedDefaultTests } from "@/app/lib/test-seeder";
import { getLabModel } from "@/app/models/master/Lab";

export const maxDuration = 300;

const connectionOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

function cleanString(value) {
  return String(value || "").trim();
}

export async function POST(req, context) {
  let tenantConnection = null;

  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const seedTests = body.seedDefaultTests === true;
    const seedInventory = body.seedDefaultInventory === true;
    if (!seedTests && !seedInventory) {
      return NextResponse.json({ error: "Select at least one default catalog" }, { status: 400 });
    }

    const { tenantId } = await context.params;
    const labIdentifier = cleanString(tenantId);
    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const isObjectId = mongoose.Types.ObjectId.isValid(labIdentifier);
    const query = isObjectId
      ? { $or: [{ _id: new mongoose.Types.ObjectId(labIdentifier) }, { tenantId: labIdentifier.toLowerCase() }, { labId: labIdentifier }] }
      : { $or: [{ tenantId: labIdentifier.toLowerCase() }, { labId: labIdentifier }] };
    const lab = await Lab.findOne(query).select("tenantId dbName +dbConnectionString defaultData");

    if (!lab) {
      return NextResponse.json({ error: "Lab not found" }, { status: 404 });
    }

    tenantConnection = await mongoose
      .createConnection(lab.dbConnectionString, {
        ...connectionOptions,
        dbName: lab.dbName,
      })
      .asPromise();

    const results = {};
    const statusUpdate = {};
    const seededAt = new Date();
    if (seedTests) {
      results.tests = await seedDefaultTests(tenantConnection);
      statusUpdate["defaultData.tests.seeded"] = true;
      statusUpdate["defaultData.tests.seededAt"] = seededAt;
      lab.set("defaultData.tests", { seeded: true, seededAt });
    }
    if (seedInventory) {
      results.inventory = await seedDefaultInventory(tenantConnection);
      statusUpdate["defaultData.inventory.seeded"] = true;
      statusUpdate["defaultData.inventory.seededAt"] = seededAt;
      lab.set("defaultData.inventory", { seeded: true, seededAt });
    }
    await Lab.collection.updateOne({ _id: lab._id }, { $set: statusUpdate });

    const completed = [seedTests && "Tests", seedInventory && "Inventory"].filter(Boolean);
    return NextResponse.json({
      message: `${completed.join(" and ")} default data is ready.`,
      seededDefaults: {
        tests: Boolean(lab.defaultData?.tests?.seeded),
        inventory: Boolean(lab.defaultData?.inventory?.seeded),
      },
      results,
    });
  } catch (error) {
    return nextJsonError("Unable to seed default lab data", error, 500);
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
}

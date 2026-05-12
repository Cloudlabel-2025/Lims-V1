import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";


//POST 
export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "patients.register");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "patients.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Patient, LabOrder, TestDefinition, TestPackage, Doctor } = await getTenantModels(tenantId);
    const body = await req.json();

    const { name, dob, age, gender, phone, receivedTime, address, selectedTests, force } = body;

    const missing = [];
    if (!name)         missing.push("Full Name");
    if (!dob)          missing.push("Date of Birth");
    if (!age)          missing.push("Age");
    if (!gender)       missing.push("Gender");
    if (!phone)        missing.push("Mobile Number");
    if (!address)      missing.push("Address");
    if (!receivedTime) missing.push("Received Time");

    if (missing.length > 0) {
      return Response.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    if (gender === "Other" && !body.genderIdentity) {
      return Response.json(
        { error: "Gender Identity is required when Gender is 'Other'" },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(String(phone))) {
      return Response.json(
        { error: "Mobile Number must be exactly 10 digits" },
        { status: 400 }
      );
    }

    if (body.uhId && !/^\d{14}$/.test(String(body.uhId))) {
      return Response.json(
        { error: "UH ID must be exactly 14 digits" },
        { status: 400 }
      );
    }

    if (body.collectionTime && new Date(body.receivedTime) < new Date(body.collectionTime)) {
      return Response.json(
        { error: "Received Time cannot be earlier than Collection Time" },
        { status: 400 }
      );
    }

    // 🔥 Duplicate mobile check (skip if force=true)
    if (!force) {
      const existing = await Patient.findOne({ phone: String(phone) }).sort({ createdAt: 1 });

      if (existing) {
        return Response.json(
          {
            warning: "Mobile already exists",
            patient: existing
          },
          { status: 200 }
        );
      }
    }

    // 🔥 Fetch Doctor if referral provided
    let doctor = null;
    if (body.refDoctorName) {
      doctor = await Doctor.findOne({ name: body.refDoctorName });
    }

    const patient = await Patient.create({
      ...body,
      phone: String(phone),
      refDoctorName: body.refDoctorName || undefined,
    });

    // 🔬 Create Lab Order if tests selected
    if (selectedTests && selectedTests.length > 0) {
      const orderItems = [];
      let totalAmount = 0;
      
      for (const itemKey of selectedTests) {
        if (itemKey.startsWith("test_")) {
          const testId = itemKey.replace("test_", "");
          const test = await TestDefinition.findById(testId).populate("category");
          if (test) {
            const price = Number(test.price) || 0;
            totalAmount += price;
            orderItems.push({
              testDefinition: test._id,
              testSnapshot: {
                testId: test.testId,
                name: test.name,
                code: test.code,
                categoryName: test.category?.name,
                sampleType: test.sampleType,
                price: price
              }
            });
          }
        } else if (itemKey.startsWith("pkg_")) {
          const pkgId = itemKey.replace("pkg_", "");
          const pkg = await TestPackage.findById(pkgId).populate({
            path: "tests",
            populate: { path: "category" }
          });
          
          if (pkg) {
            const price = Number(pkg.price) || 0;
            totalAmount += price;
            
            if (pkg.tests) {
              for (const test of pkg.tests) {
                // Avoid duplicates in items list (but price is handled by package)
                if (!orderItems.find(item => item.testDefinition.toString() === test._id.toString())) {
                  orderItems.push({
                    testDefinition: test._id,
                    testSnapshot: {
                      testId: test.testId,
                      name: test.name,
                      code: test.code,
                      categoryName: test.category?.name,
                      sampleType: test.sampleType,
                      price: 0 // Price is bundled in totalAmount
                    }
                  });
                }
              }
            }
          }
        }
      }

      if (orderItems.length > 0) {
        const commissionRate = doctor?.commission || 0;
        const commissionAmount = (totalAmount * commissionRate) / 100;

        await LabOrder.create({
          patient: patient._id,
          items: orderItems,
          referralDoctor: doctor?._id,
          totalAmount,
          commissionAmount,
          billingStatus: "unpaid",
          createdBy: auth.session?.email || "System",
          status: "open"
        });
      }
    }

    return Response.json(patient, { status: 201 });

  } catch (err) {
    console.error("POST /api/patient error:", err);

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return Response.json(
        { error: messages.join("; ") },
        { status: 400 }
      );
    }

    if (err.name === "CastError") {
      return Response.json(
        { error: `Invalid value for field '${err.path}': ${err.value}` },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}

//GET
export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "patients.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "patients.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Patient } = await getTenantModels(tenantId);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    let query = {};

    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { patientId: { $regex: search, $options: "i" } }
        ]
      };
    }

    const patients = await Patient.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    return Response.json(patients);

  } catch (err) {
    return Response.json(
      { error: "Fetch failed", details: err.message },
      { status: 500 }
    );
  }
}

import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) return Response.json({ results: [] });

    const { Patient, Doctor, Sample, TestDefinition, TestPackage } = await getTenantModels(auth.tenantId);
    const regex = { $regex: q, $options: "i" };

    const canViewPatients = hasPermission(auth.session, "patients.view");
    const canViewDoctors = hasPermission(auth.session, "doctors.view");
    const canViewSamples = hasPermission(auth.session, "samples.view");
    const canViewTests = hasPermission(auth.session, "tests.view");

    const queries = [];

    if (canViewPatients) {
      queries.push(
        Patient.find({ $or: [{ name: regex }, { patientId: regex }, { phone: regex }] })
          .limit(5).select("name patientId").lean()
          .then((docs) => docs.map((d) => ({ label: `${d.name} (${d.patientId})`, href: `/patients/edit/${d._id}`, type: "Patient" })))
      );
    }

    if (canViewDoctors) {
      queries.push(
        Doctor.find({ $or: [{ name: regex }, { doctorId: regex }] })
          .limit(5).select("name doctorId").lean()
          .then((docs) => docs.map((d) => ({ label: `${d.name} (${d.doctorId})`, href: `/doctors/edit/${d._id}`, type: "Doctor" })))
      );
    }

    if (canViewSamples) {
      queries.push(
        Sample.find({ $or: [{ sampleId: regex }, { barcode: regex }] })
          .limit(5).select("sampleId barcode").lean()
          .then((docs) => docs.map((d) => ({ label: `${d.sampleId}${d.barcode ? ` \u2014 ${d.barcode}` : ""}`, href: `/samples`, type: "Sample" })))
      );
    }

    if (canViewTests) {
      queries.push(
        TestDefinition.find({ name: regex }).limit(5).select("name testId").lean()
          .then((docs) => docs.map((d) => ({ label: `${d.name} (${d.testId})`, href: `/tests`, type: "Test" })))
      );
      queries.push(
        TestPackage.find({ name: regex }).limit(5).select("name packageId").lean()
          .then((docs) => docs.map((d) => ({ label: `${d.name} (${d.packageId})`, href: `/tests`, type: "Package" })))
      );
    }

    const results = (await Promise.all(queries)).flat();
    return Response.json({ results });
  } catch (error) {
    return jsonError("Search failed", error, 500);
  }
}

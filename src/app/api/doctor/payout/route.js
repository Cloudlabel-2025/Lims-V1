import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "doctors.edit");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Doctor } = await getTenantModels(tenantId);
    
    const { doctorId } = await req.json();

    if (!doctorId) {
      return Response.json({ error: "Doctor ID is required" }, { status: 400 });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }

    const amountCleared = doctor.pendingPayout || 0;
    
    doctor.pendingPayout = 0;
    await doctor.save();

    return Response.json({ 
      message: "Payout cleared successfully", 
      amountCleared,
      currentBalance: 0
    });

  } catch (err) {
    console.error("POST /api/doctor/payout error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

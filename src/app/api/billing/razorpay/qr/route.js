import { NextResponse } from "next/server";
import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { jsonError } from "@/app/lib/api-response";
import QRCode from "qrcode";

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "billing.collect");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { BillingRecord } = await getTenantModels(tenantId);
    
    const body = await req.json();
    const { billingRecordId, amount } = body;

    if (!billingRecordId) {
      return NextResponse.json({ error: "Billing record ID is required" }, { status: 400 });
    }
    
    const amtValue = Number(amount) || 0;
    if (amtValue <= 0) {
      return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    }

    const billingRecord = await BillingRecord.findOne({ _id: billingRecordId, tenantId }).populate("patient");
    if (!billingRecord) {
      return NextResponse.json({ error: "Billing record not found" }, { status: 404 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay integration is not configured" }, { status: 500 });
    }

    // Clean and validate phone number to avoid Razorpay validation failures
    let phone = billingRecord.patient?.phone || "+919876543210";
    phone = phone.replace(/[^0-9+]/g, "");
    if (!phone.startsWith("+")) {
      phone = "+91" + phone.replace(/^0+/, "");
    }
    // Fallback if contact has recurring digits or is too short
    const digitsOnly = phone.replace("+91", "");
    if (digitsOnly.length < 10 || /^(.)\1+$/.test(digitsOnly)) {
      phone = "+919876543210";
    }

    const patientName = billingRecord.patient?.name || "Patient";
    const patientEmail = billingRecord.patient?.email || "patient@example.com";

    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const rzpResponse = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        amount: Math.round(amtValue * 100), // convert to paise
        currency: "INR",
        description: `Payment for bill ${billingRecord.billId}`,
        reference_id: `${billingRecord.billId}_${Date.now()}`,
        customer: {
          name: patientName,
          email: patientEmail,
          contact: phone,
        },
        notify: {
          sms: false,
          email: false,
        },
        reminder_enable: false,
        notes: {
          billId: billingRecordId,
          tenantId: tenantId,
        },
      }),
    });

    const data = await rzpResponse.json();

    if (!rzpResponse.ok) {
      console.error("Razorpay Payment Link creation failed:", data);
      return NextResponse.json(
        { error: data.error?.description || "Failed to create payment link with Razorpay" },
        { status: rzpResponse.status }
      );
    }

    // Generate local base64 QR code image of the short_url
    const qrDataUrl = await QRCode.toDataURL(data.short_url, {
      margin: 1,
      width: 300,
    });

    return NextResponse.json({
      qrCodeId: data.id, // Payment Link ID
      imageUrl: qrDataUrl,
      shortUrl: data.short_url,
    });
  } catch (err) {
    console.error("POST /api/billing/razorpay/qr error:", err);
    return jsonError("Unable to create QR code", err, 500);
  }
}

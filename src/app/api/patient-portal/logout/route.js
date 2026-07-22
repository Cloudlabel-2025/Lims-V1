import { NextResponse } from "next/server";
import { clearPatientSessionCookie } from "@/app/lib/patient-session";

export async function POST(req) {
  const response = NextResponse.json({ message: "Signed out" });
  clearPatientSessionCookie(response, req);
  return response;
}

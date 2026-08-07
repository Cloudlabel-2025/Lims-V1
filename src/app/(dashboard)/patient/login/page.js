"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PatientLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/patient");
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
      <p style={{ color: "#64748b" }}>Redirecting to patient portal login...</p>
    </div>
  );
}

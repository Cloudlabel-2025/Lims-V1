"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ActivateRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const tenantId = params.get("tenantId") || "mega";

  useEffect(() => {
    // Direct patient to the dedicated login page since activation is no longer required
    router.replace(`/patient?tenantId=${encodeURIComponent(tenantId)}`);
  }, [router, tenantId]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
      <p style={{ color: "#64748b" }}>Redirecting to patient portal login...</p>
    </div>
  );
}

export default function PatientActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivateRedirect />
    </Suspense>
  );
}

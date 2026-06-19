"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forwardParams = new URLSearchParams();
    if (params.get("userType")) forwardParams.set("userType", params.get("userType"));
    if (params.get("tenantId")) forwardParams.set("tenantId", params.get("tenantId"));
    const query = forwardParams.toString();
    router.replace(`/forgot-password${query ? `?${query}` : ""}`);
  }, [router]);

  return null;
}

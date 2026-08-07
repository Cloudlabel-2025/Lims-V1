"use client";
import LoginPage from "@/app/components/LoginPage";

export default function TenantLoginPage() {
  return (
    <LoginPage
      initialUserType="tenant"
      lockUserType={false}
    />
  );
}

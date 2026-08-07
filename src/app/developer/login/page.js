"use client";
import LoginPage from "@/app/components/LoginPage";

export default function DeveloperLoginPage() {
  return (
    <LoginPage
      initialUserType="developer"
      lockUserType={true}
    />
  );
}

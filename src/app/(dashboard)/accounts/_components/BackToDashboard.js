"use client";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";

export default function BackToDashboard({ href = "/accounts", label = "Back to Dashboard" }) {
  const router = useRouter();
  return (
    <button type="button" className="btn-lims-secondary" onClick={() => router.push(href)} style={{ height: 38, padding: "0 14px" }}>
      {Icons.arrowLeft} {label}
    </button>
  );
}

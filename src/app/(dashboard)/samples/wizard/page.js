"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import StepDetails from "./steps/StepDetails";
import StepResults from "./steps/StepResults";
import StepReview from "./steps/StepReview";

const STEPS = [
  { key: "details", label: "Sample Details" },
  { key: "results", label: "Enter Results" },
  { key: "review", label: "Review & Submit" },
];

function WizardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sampleId = searchParams.get("sampleId");
  const [currentStep, setCurrentStep] = useState(0);
  const [sample, setSample] = useState(null);
  const [testDef, setTestDef] = useState(null);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!sampleId) {
      setError("No sample selected. Please go back and choose a sample.");
      setLoading(false);
      return;
    }
    fetch(`/api/samples/${sampleId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const s = data.sample || data;
        setSample(s);
        return s.testDefinition;
      })
      .then((testDefId) => {
        if (!testDefId) throw new Error("No test definition linked to this sample.");
        return fetch(`/api/tests/definitions/${testDefId}`, { credentials: "include" });
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setTestDef(data.test || data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sampleId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/samples/${sampleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "record-results", results }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save results");
      setSuccess(`Results saved for ${data.sample?.sampleId || sampleId}. Sample moved to Completed.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="module-page" style={{ padding: 40, textAlign: "center" }}>Loading sample...</div>;
  }

  if (error && !sample) {
    return (
      <div className="module-page" style={{ padding: 40, textAlign: "center" }}>
        <div className="module-alert">{error}</div>
        <button className="dash-btn-secondary" style={{ marginTop: 16 }} onClick={() => router.push("/samples")}>
          {Icons.arrowLeft} Back to Samples
        </button>
      </div>
    );
  }

  function renderStep() {
    switch (currentStep) {
      case 0:
        return <StepDetails sample={sample} onNext={() => setCurrentStep(1)} />;
      case 1:
        return (
          <StepResults
            testDef={testDef}
            results={results}
            setResults={setResults}
            onNext={() => setCurrentStep(2)}
            onBack={() => setCurrentStep(0)}
          />
        );
      case 2:
        return (
          <StepReview
            testDef={testDef}
            sample={sample}
            results={results}
            onBack={() => setCurrentStep(1)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="module-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="dash-btn-secondary" type="button" onClick={() => router.push("/samples")} style={{ height: 34, padding: "0 10px" }}>
          {Icons.arrowLeft}
        </button>
      </div>

      {error && <div className="module-alert" style={{ marginBottom: 16 }}>{error}</div>}
      <SuccessDialog message={success} onClose={() => router.push("/samples")} />

      <div className="wizard-progress">
        {STEPS.map((step, i) => (
          <div key={step.key} className={`wizard-step ${i === currentStep ? "active" : i < currentStep ? "done" : ""}`}>
            <div className="wizard-step-number">{i < currentStep ? String.fromCharCode(10003) : i + 1}</div>
            <span className="wizard-step-label">{step.label}</span>
          </div>
        ))}
      </div>

      <div className="wizard-step-card">{renderStep()}</div>
    </div>
  );
}

export default function WizardPage() {
  return (
    <Suspense fallback={<div className="module-page" style={{ padding: 40, textAlign: "center" }}>Loading...</div>}>
      <WizardInner />
    </Suspense>
  );
}

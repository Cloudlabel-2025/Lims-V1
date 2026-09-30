"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { useCurrentUser } from "@/app/lib/use-current-user";
import { hasPermission } from "@/app/lib/client-rbac";
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
  const user = useCurrentUser();
  const canCollectSamples = hasPermission(user, "samples.collect");
  const sampleId = searchParams.get("sampleId");
  const [currentStep, setCurrentStep] = useState(0);
  const [sample, setSample] = useState(null);
  const [testDefs, setTestDefs] = useState([]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [reservedInventory, setReservedInventory] = useState([]);

  useEffect(() => {
    if (!sampleId) {
      setError("No sample selected. Please go back and choose a sample.");
      setLoading(false);
      return;
    }
    async function loadSample() {
      try {
        const response = await fetch(`/api/samples/${sampleId}`, { credentials: "include" });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || "Unable to load sample");
        const loadedSample = data.sample || data;
        setSample(loadedSample);

        if (loadedSample.investigations?.length) {
          setTestDefs(loadedSample.investigations.map((investigation) => ({
            ...investigation.testDefinition,
            investigationKey: investigation._id,
            snapshot: investigation.testSnapshot,
          })));
        } else if (loadedSample.testDefinition && typeof loadedSample.testDefinition === "object") {
          setTestDefs([{ ...loadedSample.testDefinition, investigationKey: "legacy", snapshot: loadedSample.testSnapshot }]);
        } else {
          throw new Error("No test definitions are linked to this sample.");
        }

        if (loadedSample.reservedInventory?.length) {
          setReservedInventory(
            loadedSample.reservedInventory.map((r) => {
              const itemDoc = r.item && typeof r.item === "object" ? r.item : null;
              const uomDoc = r.uom && typeof r.uom === "object" ? r.uom : null;
              const itemId = itemDoc?._id || r.item || "";
              const uomId = uomDoc?._id || r.uom || "";
              return {
                item: String(itemId),
                quantity: r.quantityBase ?? r.quantity ?? "",
                uom: String(uomId),
                searchQuery: itemDoc ? `${itemDoc.itemCode} - ${itemDoc.name}` : "",
                isOpen: false,
                isReserved: true,
              };
            })
          );
        } else {
          const testList = loadedSample.investigations?.length
            ? loadedSample.investigations.map((inv) => inv.testDefinition).filter(Boolean)
            : loadedSample.testDefinition && typeof loadedSample.testDefinition === "object"
            ? [loadedSample.testDefinition]
            : [];

          const initialConfigured = [];
          for (const testDef of testList) {
            if (Array.isArray(testDef.requiredInventoryItems)) {
              for (const reqItem of testDef.requiredInventoryItems) {
                const itemDoc = reqItem.item && typeof reqItem.item === "object" ? reqItem.item : null;
                const uomDoc = reqItem.uom && typeof reqItem.uom === "object" ? reqItem.uom : null;
                const itemId = itemDoc?._id || reqItem.item || "";
                const uomId = uomDoc?._id || reqItem.uom || "";
                if (itemId) {
                  initialConfigured.push({
                    item: String(itemId),
                    quantity: reqItem.quantityPerTest ?? "",
                    uom: String(uomId),
                    searchQuery: itemDoc ? `${itemDoc.itemCode} - ${itemDoc.name}` : "",
                    isOpen: false,
                    requiredByTest: true,
                  });
                }
              }
            }
          }
          if (initialConfigured.length > 0) {
            setReservedInventory(initialConfigured);
          }
        }
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadSample();

    // Fetch inventory items and UOMs for consumption form (both come from same endpoint)
    fetch("/api/inventory?limit=100", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const items = data.items || [];
        const uomList = data.uoms || [];
        setInventoryItems(items);
        setUoms(uomList);
        setReservedInventory((prev) =>
          prev.map((row) => {
            if (row.item && (!row.searchQuery || !row.uom)) {
              const matched = items.find((it) => String(it._id) === String(row.item));
              const matchedUom = matched?.baseUom?._id || matched?.baseUom || row.uom;
              return {
                ...row,
                searchQuery: matched ? `${matched.itemCode} - ${matched.name}` : row.searchQuery,
                uom: row.uom || String(matchedUom || ""),
              };
            }
            return row;
          })
        );
      })
      .catch(() => {});
  }, [sampleId]);

  async function handleSubmit(finalNotes) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/samples/${sampleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "record-results",
          results,
          investigationResults: testDefs.map((testDef) => ({
            investigationId: String(testDef.investigationKey),
            testDefinitionId: String(testDef._id || ""),
            values: results[testDef.investigationKey] || {},
          })),
          notes: finalNotes,
          reservedInventory: reservedInventory
            .filter((r) => r.item)
            .map((r) => ({ item: r.item, uom: r.uom, quantity: r.quantity }))
        }),
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

  if (sample && sample.status === "registered" && !canCollectSamples) {
    return (
      <div className="module-page" style={{ padding: 40, textAlign: "center" }}>
        <div className="module-alert" style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          <strong>Access Denied:</strong> Your role does not have permission to collect samples. Please contact your lab administrator to assign the &quot;Collect Samples&quot; permission.
        </div>
        <button className="dash-btn-secondary" style={{ marginTop: 16 }} onClick={() => router.push("/samples")}>
          {Icons.arrowLeft} Back to Samples
        </button>
      </div>
    );
  }

  async function handleStartProcessing() {
    if (!sample || sample.status === "processing") {
      setCurrentStep(1);
      return;
    }
    if (sample.status === "registered" && !canCollectSamples) {
      setError("Permission denied: You do not have permission to collect samples.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payloadInventory = reservedInventory
        .filter((r) => r.item)
        .map((r) => ({
          item: r.item,
          quantity: r.quantity,
          uom: r.uom,
        }));

      const res = await fetch(`/api/samples/${sampleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "start-processing",
          reservedInventory: payloadInventory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start processing");
      setSample(data.sample);
      if (data.sample?.reservedInventory?.length) {
        setReservedInventory(
          data.sample.reservedInventory.map((r) => {
            const itemDoc = r.item && typeof r.item === "object" ? r.item : null;
            const uomDoc = r.uom && typeof r.uom === "object" ? r.uom : null;
            const itemId = itemDoc?._id || r.item || "";
            const uomId = uomDoc?._id || r.uom || "";
            return {
              item: String(itemId),
              quantity: r.quantityBase ?? r.quantity ?? "",
              uom: String(uomId),
              searchQuery: itemDoc ? `${itemDoc.itemCode} - ${itemDoc.name}` : "",
              isOpen: false,
              isReserved: true,
            };
          })
        );
      }
      setCurrentStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderStep() {
    switch (currentStep) {
      case 0:
        return (
          <StepDetails
            sample={sample}
            onNext={() => setCurrentStep(1)}
            onStartProcessing={handleStartProcessing}
            submitting={submitting}
            inventoryItems={inventoryItems}
            uoms={uoms}
            reservedInventory={reservedInventory}
            setReservedInventory={setReservedInventory}
          />
        );
      case 1:
        return (
          <StepResults
            testDefs={testDefs}
            results={results}
            setResults={setResults}
            onNext={() => setCurrentStep(2)}
            onBack={() => setCurrentStep(0)}
          />
        );
      case 2:
        return (
          <StepReview
            testDefs={testDefs}
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

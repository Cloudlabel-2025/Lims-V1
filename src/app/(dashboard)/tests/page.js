"use client";

import { useState, useRef, useCallback } from "react";
import { Icons } from "@/app/components/Icons";

/* -------------------------------------------------------------------------- */
/*                                  MOCK DATA                                 */
/* -------------------------------------------------------------------------- */

const MOCK_CATEGORIES = [
  { _id: "cat1", name: "Hematology", categoryId: "TCAT-000001" },
  { _id: "cat2", name: "Biochemistry", categoryId: "TCAT-000002" },
  { _id: "cat3", name: "Clinical Pathology", categoryId: "TCAT-000003" },
];

const MOCK_TESTS = [
  {
    _id: "t1",
    name: "Complete Blood Count",
    code: "CBC",
    category: MOCK_CATEGORIES[0],
    sampleType: "EDTA Blood",
    price: 350,
    status: "active",
    method: "Automated Hematology Analyzer",
    parameters: [
      { name: "Hemoglobin", unit: "g/dL", maleRange: { min: 13, max: 17 }, femaleRange: { min: 12, max: 15 }, required: true },
      { name: "Total WBC Count", unit: "cells/cu.mm", maleRange: { min: 4000, max: 11000 }, femaleRange: { min: 4000, max: 11000 }, required: true },
    ],
  },
];

const MOCK_PACKAGES = [
  {
    _id: "p1",
    name: "General Health Checkup",
    code: "GHC",
    description: "Basic screening for general wellness",
    price: 400,
    status: "active",
    tests: [MOCK_TESTS[0]],
  },
];

/* -------------------------------------------------------------------------- */
/*                                  DEFAULTS                                  */
/* -------------------------------------------------------------------------- */

const blankParameter = {
  name: "",
  unit: "",
  maleRange: { min: "", max: "" },
  femaleRange: { min: "", max: "" },
  required: true,
  notesRequired: false,
};

const blankTestForm = {
  name: "",
  code: "",
  category: "",
  sampleType: "",
  price: "",
  method: "",
  smsFormat: "",
  printPosition: "",
  showNormalRange: true,
  status: "active",
  parameters: [{ ...blankParameter }],
};

export default function TestsPage() {
  const [activeTab, setActiveTab] = useState("tests"); // tests | packages | categories
  const [categories, setCategories] = useState(MOCK_CATEGORIES);
  const [tests, setTests] = useState(MOCK_TESTS);
  const [packages, setPackages] = useState(MOCK_PACKAGES);

  const [testForm, setTestForm] = useState(blankTestForm);
  const [categoryName, setCategoryName] = useState("");
  const [editingId, setEditingId] = useState("");

  /* ---------- Helpers ---------- */

  const resetForms = () => {
    setEditingId("");
    setTestForm({ ...blankTestForm, category: categories[0]?._id || "" });
  };

  const handleEditTest = (test) => {
    setEditingId(test._id);
    setActiveTab("tests");
    setTestForm({
      ...test,
      category: test.category?._id || test.category,
      parameters: test.parameters?.length ? test.parameters : [{ ...blankParameter }],
    });
  };

  const updateParameter = (index, field, value, subField = null) => {
    setTestForm((prev) => {
      const updated = [...prev.parameters];
      if (subField) {
        updated[index] = {
          ...updated[index],
          [field]: { ...updated[index][field], [subField]: value }
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, parameters: updated };
    });
  };

  const saveTest = (e) => {
    e.preventDefault();
    const savedTest = {
      ...testForm,
      _id: editingId || `t-${Date.now()}`,
      category: categories.find(c => c._id === testForm.category) || { name: "Uncategorized" },
    };

    if (editingId) {
      setTests(prev => prev.map(t => t._id === editingId ? savedTest : t));
    } else {
      setTests(prev => [savedTest, ...prev]);
    }
    resetForms();
  };

  const tabButtonStyle = (isActive) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    outline: 'none',
    background: isActive ? '#fff' : 'transparent',
    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.2s',
    boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
    whiteSpace: 'nowrap'
  });

  return (
    <div className="tests-master-page" style={{ padding: '4px' }}>
      
      {/* PAGE HEADER */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="page-header-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
            {Icons.flask}
          </div>
          <div className="page-header-text">
            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Test & Package Master</h4>
            <small style={{ color: 'var(--text-secondary)' }}>Configure investigations and clinical bundles</small>
          </div>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', background: 'var(--border-light)', padding: '4px', borderRadius: '10px' }}>
            <button style={tabButtonStyle(activeTab === 'tests')} onClick={() => { setActiveTab('tests'); resetForms(); }}>Tests</button>
            <button style={tabButtonStyle(activeTab === 'packages')} onClick={() => { setActiveTab('packages'); resetForms(); }}>Packages</button>
            <button style={tabButtonStyle(activeTab === 'categories')} onClick={() => { setActiveTab('categories'); resetForms(); }}>Categories</button>
          </div>
          <button className="btn-lims-primary" style={{ height: '40px', padding: '0 16px' }} onClick={resetForms}>
            {Icons.plus} Add New
          </button>
        </div>
      </div>

      <div className="dash-content-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT PANEL: Form */}
        <section>
          {activeTab === 'tests' && (
            <div className="form-card" style={{ padding: '24px' }}>
              <h6 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', marginBottom: '20px' }}>
                {editingId ? "Update Test Definition" : "New Test Definition"}
              </h6>

              <form onSubmit={saveTest} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Investigation Name</label>
                  <input className="lims-input" value={testForm.name} onChange={(e) => setTestForm({...testForm, name: e.target.value})} placeholder="e.g. Lipid Profile" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Short Code</label>
                  <input className="lims-input" value={testForm.code} onChange={(e) => setTestForm({...testForm, code: e.target.value})} placeholder="e.g. LIPID" />
                </div>
                <div className="form-group">
                  <label className="form-label">Price (₹)</label>
                  <input className="lims-input" type="number" value={testForm.price} onChange={(e) => setTestForm({...testForm, price: e.target.value})} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="lims-input" value={testForm.category} onChange={(e) => setTestForm({...testForm, category: e.target.value})} required>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Method</label>
                  <input className="lims-input" value={testForm.method} onChange={(e) => setTestForm({...testForm, method: e.target.value})} placeholder="Analyzer Name" />
                </div>

                <div style={{ gridColumn: 'span 2', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h6 style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Clinical Parameters</h6>
                    <button type="button" style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }} onClick={() => setTestForm({...testForm, parameters: [...testForm.parameters, {...blankParameter}]})}>
                      {Icons.plus} Add Parameter
                    </button>
                  </div>
                  
                  {testForm.parameters.map((param, idx) => (
                    <div key={idx} style={{ background: 'var(--surface)', padding: '16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '12px', marginBottom: '12px' }}>
                        <input className="lims-input" value={param.name} onChange={(e) => updateParameter(idx, "name", e.target.value)} placeholder="Parameter Name" />
                        <input className="lims-input" value={param.unit} onChange={(e) => updateParameter(idx, "unit", e.target.value)} placeholder="Unit" />
                        <button type="button" style={{ border: 'none', background: 'transparent', color: '#ef4444', padding: '4px', cursor: 'pointer' }} onClick={() => setTestForm({...testForm, parameters: testForm.parameters.filter((_,i) => i !== idx)})}>
                          {Icons.trash}
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          <small style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Male Range</small>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input className="lims-input" style={{ height: '32px' }} value={param.maleRange.min} onChange={(e) => updateParameter(idx, "maleRange", e.target.value, "min")} placeholder="Min" />
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                            <input className="lims-input" style={{ height: '32px' }} value={param.maleRange.max} onChange={(e) => updateParameter(idx, "maleRange", e.target.value, "max")} placeholder="Max" />
                          </div>
                        </div>
                        <div style={{ padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          <small style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Female Range</small>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input className="lims-input" style={{ height: '32px' }} value={param.femaleRange.min} onChange={(e) => updateParameter(idx, "femaleRange", e.target.value, "min")} placeholder="Min" />
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                            <input className="lims-input" style={{ height: '32px' }} value={param.femaleRange.max} onChange={(e) => updateParameter(idx, "femaleRange", e.target.value, "max")} placeholder="Max" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="submit" className="btn-lims-primary" style={{ flex: 1, height: '44px' }}>Save Test Definition</button>
                  <button type="button" className="btn-lims-secondary" style={{ padding: '0 20px', border: '1.5px solid var(--border)', borderRadius: '10px', background: '#fff' }} onClick={resetForms}>Reset</button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'packages' && (
            <div className="form-card" style={{ padding: '24px' }}>
              <h6 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', marginBottom: '20px' }}>Health Package Builder</h6>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Package Name</label>
                  <input className="lims-input" placeholder="e.g. Master Health Checkup" />
                </div>
                <div className="form-group">
                  <label className="form-label">Package Price (₹)</label>
                  <input className="lims-input" type="number" placeholder="0" />
                </div>
              </div>
              <div style={{ marginTop: '24px' }}>
                <h6 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>Included Tests</h6>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                  {tests.map(t => (
                    <div key={t._id} style={{ padding: '12px', border: '1.5px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', cursor: 'pointer' }}>
                      <div style={{ width: '20px', height: '20px', border: '2px solid var(--primary)', borderRadius: '6px' }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600' }}>₹{t.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn-lims-primary" style={{ marginTop: '24px', width: '100%', height: '44px' }}>Create Package Bundle</button>
            </div>
          )}
        </section>

        {/* RIGHT PANEL: Inventory */}
        <aside>
          <div className="dash-card" style={{ overflow: 'hidden' }}>
            <div className="dash-card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Inventory</h3>
              <div className="search-container" style={{ position: 'relative', flex: 1, maxWidth: '180px' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{Icons.search}</span>
                <input className="lims-input" style={{ height: '36px', paddingLeft: '32px', fontSize: '12px', width: '100%' }} placeholder="Search..." />
              </div>
            </div>
            
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {activeTab === 'tests' && tests.map(test => (
                <div key={test._id} onClick={() => handleEditTest(test)} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', background: editingId === test._id ? 'var(--primary-50)' : 'transparent', borderLeft: editingId === test._id ? '4px solid var(--primary)' : '4px solid transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: editingId === test._id ? 'var(--primary)' : 'var(--primary-50)', color: editingId === test._id ? '#fff' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {Icons.flask}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{test.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>{test.category?.name} • {test.parameters?.length} Params</div>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)', whiteSpace: 'nowrap', marginLeft: '8px' }}>₹{test.price}</div>
                  </div>
                </div>
              ))}

              {activeTab === 'packages' && packages.map(pkg => (
                <div key={pkg._id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {Icons.grid}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{pkg.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{pkg.tests?.length} Tests</div>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)' }}>₹{pkg.price}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </div>

      <style jsx>{`
        .form-label {
          display: block;
          font-size: 11px;
          font-weight: 800;
          color: var(--text-secondary);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}

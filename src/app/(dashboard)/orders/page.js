"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Icons } from "@/app/components/Icons";

const PAYMENT_MODES = ["Cash", "UPI", "Credit Card", "Debit Card", "Net Banking"];

export default function BillingPage() {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchPatient, setSearchPatient] = useState("");
  const [activeTab, setActiveTab] = useState("tests"); // for items: tests | packages
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState("flat"); // flat | percent
  const [discountValue, setDiscountValue] = useState(0);
  const [payments, setPayments] = useState([{ mode: "Cash", amount: 0 }]);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  
  const [patients, setPatients] = useState([]);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);

  const [searchItem, setSearchItem] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingItem, setIsSearchingItem] = useState(false);

  /* ---------- Patient Search ---------- */
  useEffect(() => {
    if (!searchPatient.trim()) {
      setPatients([]);
      setIsSearchingPatient(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPatient(true);
      try {
        const res = await fetch(`/api/patient?search=${encodeURIComponent(searchPatient)}`);
        const data = await res.json();
        setPatients(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Patient search failed:", err);
      } finally {
        setIsSearchingPatient(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchPatient]);

  /* ---------- Investigation Search ---------- */
  useEffect(() => {
    if (!searchItem.trim()) {
      setSearchResults([]);
      setIsSearchingItem(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingItem(true);
      try {
        const [testsRes, pkgsRes] = await Promise.all([
          fetch(`/api/tests/definitions?search=${encodeURIComponent(searchItem)}&status=active`),
          fetch(`/api/tests/packages?search=${encodeURIComponent(searchItem)}&status=active`)
        ]);

        const testsData = await testsRes.json();
        const pkgsData = await pkgsRes.json();

        const combined = [
          ...(testsData.tests || []).map(t => ({ ...t, type: 'test' })),
          ...(pkgsData.packages || []).map(p => ({ ...p, type: 'package' }))
        ];

        setSearchResults(combined);
      } catch (err) {
        console.error("Item search failed:", err);
      } finally {
        setIsSearchingItem(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchItem]);

  /* ---------- Calculations ---------- */
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price, 0), [cart]);
  
  const discountAmount = useMemo(() => {
    if (discountType === "percent") return (subtotal * (Number(discountValue) || 0)) / 100;
    return Number(discountValue) || 0;
  }, [subtotal, discountType, discountValue]);

  const netAmount = subtotal - discountAmount;
  const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [payments]);
  const balanceDue = netAmount - totalPaid;

  /* ---------- Handlers ---------- */
  const toggleCartItem = (item) => {
    setCart(prev => prev.find(i => i._id === item._id) 
      ? prev.filter(i => i._id !== item._id) 
      : [...prev, item]
    );
  };

  const addPaymentRow = () => {
    setPayments([...payments, { mode: "UPI", amount: 0 }]);
  };

  const removePaymentRow = (idx) => {
    setPayments(payments.filter((_, i) => i !== idx));
  };

  const updatePayment = (idx, field, value) => {
    const updated = [...payments];
    updated[idx][field] = value;
    setPayments(updated);
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
  });

  return (
    <div className="billing-module-page" style={{ padding: '4px' }}>
      
      {/* PAGE HEADER */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="page-header-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
            {Icons.logo}
          </div>
          <div className="page-header-text">
            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Billing & Registration</h4>
            <small style={{ color: 'var(--text-secondary)' }}>Create orders, apply discounts and record payments</small>
          </div>
        </div>
      </div>

      <div className="billing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT PANEL: Patient & Test Selection */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. Patient Selection */}
          <div className="form-card" style={{ padding: '24px', overflow: 'visible' }}>
            <h6 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px' }}>1. Patient Information</h6>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{Icons.search}</span>
              <input 
                className="lims-input" 
                style={{ paddingLeft: '38px', height: '48px' }} 
                placeholder="Search by Patient Name, ID or Phone..." 
                value={searchPatient}
                onChange={(e) => setSearchPatient(e.target.value)}
              />
              {searchPatient && !selectedPatient && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', zIndex: 10, marginTop: '8px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                  {isSearchingPatient ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div className="search-spinner"></div> Searching patients...
                    </div>
                  ) : patients.length > 0 ? (
                    patients.map(p => (
                      <div key={p._id} className="search-result-item" onClick={() => { setSelectedPatient(p); setSearchPatient(""); }} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '14px' }}>{p.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.patientId || p._id.slice(-6).toUpperCase()}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>{p.phone}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No patients found matching "{searchPatient}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedPatient && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'var(--primary-50)', borderRadius: '12px', border: '1px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '15px' }}>{selectedPatient.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {selectedPatient.patientId} • Phone: {selectedPatient.phone}</div>
                </div>
                <button style={{ border: 'none', background: 'transparent', color: '#ef4444', fontWeight: '700', cursor: 'pointer' }} onClick={() => setSelectedPatient(null)}>Change</button>
              </div>
            )}
          </div>

          {/* 2. Test & Package Selection */}
          <div className="form-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h6 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>2. Select Investigations</h6>
            </div>

            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{Icons.search}</span>
              <input 
                className="lims-input" 
                style={{ paddingLeft: '38px', height: '48px' }} 
                placeholder="Search Investigation by Name or Short Code (e.g. CBC, Lipid)..." 
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
              />
              
              {searchItem && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', zIndex: 10, marginTop: '8px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                  {isSearchingItem ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div className="search-spinner"></div> Searching investigations...
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(item => {
                      const inCart = cart.find(i => i._id === item._id);
                      return (
                        <div 
                          key={item._id} 
                          className="search-result-item" 
                          onClick={() => { toggleCartItem(item); if (!inCart) setSearchItem(""); }} 
                          style={{ 
                            padding: '12px 16px', 
                            cursor: 'pointer', 
                            borderBottom: '1px solid var(--border-light)', 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: inCart ? 'var(--primary-50)' : 'transparent'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: item.type === 'package' ? '#fff7ed' : 'var(--primary-50)', color: item.type === 'package' ? '#ea580c' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {item.type === 'package' ? Icons.grid : Icons.flask}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '14px' }}>{item.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.code} • {item.type.toUpperCase()}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)' }}>₹{item.price}</div>
                            {inCart && <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>Added</span>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No investigations found matching "{searchItem}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick selection or cart list */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
               {cart.length > 0 ? (
                 cart.map(item => (
                    <div 
                      key={item._id} 
                      onClick={() => toggleCartItem(item)}
                      style={{ 
                        padding: '16px', 
                        borderRadius: '14px', 
                        border: '2px solid var(--primary)', 
                        background: 'var(--primary-50)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: '2px solid var(--primary)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{item.code}</div>
                      </div>
                      <div style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '14px' }}>₹{item.price}</div>
                    </div>
                 ))
               ) : (
                 <div style={{ gridColumn: 'span 2', padding: '40px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: '16px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>{Icons.flask}</div>
                    <div style={{ fontWeight: '600' }}>No investigations selected</div>
                    <small>Search and select tests to add to the bill</small>
                 </div>
               )}
            </div>
          </div>

          {/* 3. Payment Breakdown */}
          <div className="form-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h6 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>3. Payment Breakdown</h6>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Split Payment</span>
                <div 
                  onClick={() => setIsSplitPayment(!isSplitPayment)}
                  style={{ width: '40px', height: '20px', background: isSplitPayment ? 'var(--primary)' : 'var(--border)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: isSplitPayment ? '22px' : '2px', transition: 'all 0.3s' }}></div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {payments.map((p, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                  <select className="lims-input" value={p.mode} onChange={(e) => updatePayment(idx, "mode", e.target.value)}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: 'var(--text-muted)' }}>₹</span>
                    <input 
                      type="number" 
                      className="lims-input" 
                      style={{ paddingLeft: '28px' }} 
                      value={p.amount} 
                      onChange={(e) => updatePayment(idx, "amount", e.target.value)} 
                    />
                  </div>
                  {isSplitPayment && idx > 0 && (
                    <button style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }} onClick={() => removePaymentRow(idx)}>{Icons.trash}</button>
                  )}
                </div>
              ))}
              {isSplitPayment && (
                <button 
                  onClick={addPaymentRow}
                  style={{ border: '1.5px dashed var(--primary)', background: 'var(--primary-50)', color: 'var(--primary)', padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', marginTop: '8px' }}
                >
                  + Add Payment Mode
                </button>
              )}
            </div>

            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '10px', background: balanceDue === 0 ? '#f0fdf4' : '#fff7ed', border: balanceDue === 0 ? '1px solid #bbf7d0' : '1px solid #ffedd5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: balanceDue === 0 ? '#166534' : '#9a3412' }}>
                {balanceDue === 0 ? "Full Amount Covered" : balanceDue > 0 ? `Remaining: ₹${balanceDue}` : `Excess: ₹${Math.abs(balanceDue)}`}
              </div>
              <div style={{ height: '6px', width: '100px', background: 'rgba(0,0,0,0.05)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (totalPaid / netAmount) * 100)}%`, background: balanceDue === 0 ? '#22c55e' : 'var(--primary)', transition: 'width 0.3s' }}></div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: Order Summary */}
        <aside style={{ position: 'sticky', top: '24px' }}>
          <div className="form-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ background: 'var(--primary)', padding: '24px', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.8, marginBottom: '4px' }}>Order Summary</div>
              <div style={{ fontSize: '32px', fontWeight: '800' }}>₹{netAmount.toFixed(0)}</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>{cart.length} investigations selected</div>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '24px' }}>
                {cart.map(item => (
                  <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{item.name}</div>
                    <div style={{ fontWeight: '700' }}>₹{item.price}</div>
                  </div>
                ))}
                {cart.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>Cart is empty</div>}
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '20px 0' }} />

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>Apply Discount</div>
                  <div style={{ display: 'flex', background: 'var(--border-light)', borderRadius: '6px', padding: '2px' }}>
                    <button style={{ border: 'none', background: discountType === 'flat' ? '#fff' : 'transparent', padding: '2px 8px', fontSize: '10px', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' }} onClick={() => setDiscountType('flat')}>₹</button>
                    <button style={{ border: 'none', background: discountType === 'percent' ? '#fff' : 'transparent', padding: '2px 8px', fontSize: '10px', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' }} onClick={() => setDiscountType('percent')}>%</button>
                  </div>
                </div>
                <input 
                  type="number" 
                  className="lims-input" 
                  style={{ height: '40px', fontSize: '14px', fontWeight: '700' }} 
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="Discount value" 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ef4444', fontWeight: '600' }}>
                  <span>Discount</span>
                  <span>-₹{discountAmount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', marginTop: '8px', color: 'var(--text-primary)', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                  <span>Total Amount</span>
                  <span>₹{netAmount}</span>
                </div>
              </div>

              <button className="btn-lims-primary" style={{ width: '100%', height: '54px', fontSize: '16px' }} disabled={!selectedPatient || cart.length === 0}>
                Complete Order & Print
              </button>
            </div>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .search-result-item:hover {
          background: var(--surface);
        }
        .search-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

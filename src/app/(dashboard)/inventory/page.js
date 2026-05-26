"use client";

import { useState } from "react";
import { Icons } from "@/app/components/Icons";

// Dummy data for the UI
const initialInventory = [
  { id: 1, name: "Syringes (10ml)", category: "Consumables", stock: 1250, unit: "pcs", threshold: 500, status: "In Stock", lastRestocked: "2026-05-20" },
  { id: 2, name: "Reagent A (Blood Grouping)", category: "Reagents", stock: 45, unit: "vials", threshold: 50, status: "Low Stock", lastRestocked: "2026-05-15" },
  { id: 3, name: "Test Tubes (EDTA)", category: "Consumables", stock: 3000, unit: "pcs", threshold: 1000, status: "In Stock", lastRestocked: "2026-05-22" },
  { id: 4, name: "Microscope Slides", category: "Equipment", stock: 12, unit: "boxes", threshold: 20, status: "Low Stock", lastRestocked: "2026-04-10" },
  { id: 5, name: "Isopropanol 70%", category: "Chemicals", stock: 2, unit: "liters", threshold: 5, status: "Critical", lastRestocked: "2026-03-05" },
  { id: 6, name: "Gloves (Nitrile, Medium)", category: "Consumables", stock: 85, unit: "boxes", threshold: 30, status: "In Stock", lastRestocked: "2026-05-25" },
];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [inventory, setInventory] = useState(initialInventory);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "In Stock": return "var(--primary)";
      case "Low Stock": return "#f59e0b";
      case "Critical": return "#ef4444";
      default: return "var(--text-muted)";
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case "In Stock": return "var(--primary-50)";
      case "Low Stock": return "#fef3c7";
      case "Critical": return "#fee2e2";
      default: return "var(--surface)";
    }
  };

  return (
    <div className="module-page" style={{ animation: "fadeIn 0.5s ease-out" }}>
      <div className="module-header">
        <div>
          <p className="module-kicker">Resource Management</p>
          <h1>Inventory Hub</h1>
          <span>Monitor stock levels, manage orders, and track laboratory resources seamlessly.</span>
        </div>
        <div className="module-header-actions">
          <button className="dash-btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {Icons.upload} Export Report
          </button>
          <button className="dash-btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center', boxShadow: '0 4px 14px 0 rgba(13, 148, 136, 0.39)' }}>
            {Icons.plus} Add Item
          </button>
        </div>
      </div>

      <div className="module-tabs" style={{ display: "flex", gap: "24px", marginBottom: "28px", borderBottom: "1px solid var(--border-light)", padding: "0 4px", overflowX: "auto", whiteSpace: "nowrap" }}>
        {['overview', 'reagents', 'consumables', 'equipment', 'orders'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)} 
            style={{ 
              padding: "12px 4px", 
              background: "none", 
              border: "none", 
              borderBottom: activeTab === tab ? "2.5px solid var(--brand-action, var(--primary))" : "2.5px solid transparent",
              color: activeTab === tab ? "var(--brand-action, var(--primary))" : "var(--text-muted)",
              fontWeight: activeTab === tab ? "700" : "500",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s",
              textTransform: "capitalize"
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ animation: "slideIn 0.4s ease-out" }}>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div className="inventory-stat-card">
              <div className="stat-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
                {Icons.cube}
              </div>
              <div className="stat-value">1,248</div>
              <div className="stat-label">Total Items in Stock</div>
            </div>
            
            <div className="inventory-stat-card">
              <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <div className="stat-value">12</div>
              <div className="stat-label">Low Stock Alerts</div>
            </div>

            <div className="inventory-stat-card">
              <div className="stat-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
                {Icons.trash}
              </div>
              <div className="stat-value">3</div>
              <div className="stat-label">Critical Depletions</div>
            </div>

            <div className="inventory-stat-card">
              <div className="stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              </div>
              <div className="stat-value">5</div>
              <div className="stat-label">Pending Orders</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '100%' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                {Icons.search}
              </div>
              <input 
                type="text" 
                placeholder="Search inventory by name or category..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px 16px 12px 48px', 
                  borderRadius: '100px', 
                  border: '1px solid var(--border)',
                  background: 'var(--surface-card)',
                  outline: 'none',
                  fontSize: '14px',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'all 0.2s'
                }} 
              />
            </div>
            
            <button className="dash-btn-secondary" style={{ borderRadius: '100px', padding: '12px 20px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              Filter
            </button>
          </div>

          {/* Main Table */}
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item Details</th>
                  <th>Category</th>
                  <th>Stock Level</th>
                  <th>Status</th>
                  <th>Last Restocked</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{item.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: INV-{item.id.toString().padStart(4, '0')}</div>
                    </td>
                    <td>
                      <span style={{ 
                        background: 'var(--surface)', 
                        padding: '4px 10px', 
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)'
                      }}>
                        {item.category}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden', minWidth: '60px' }}>
                          <div style={{ 
                            height: '100%', 
                            background: getStatusColor(item.status),
                            width: `${Math.min(100, (item.stock / (item.threshold * 3)) * 100)}%`,
                            borderRadius: '10px'
                          }}></div>
                        </div>
                        <span style={{ fontWeight: 600 }}>{item.stock}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.unit}</span>
                      </div>
                    </td>
                    <td>
                      <div className="inventory-status-badge" style={{ background: getStatusBg(item.status), color: getStatusColor(item.status) }}>
                        <div className="inventory-status-dot" style={{ background: getStatusColor(item.status) }}></div>
                        {item.status}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {new Date(item.lastRestocked).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button className="inventory-action-btn" title="Edit Item">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button className="inventory-action-btn" title="Reorder">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                      </div>
                      <p>No inventory items found matching your criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {activeTab !== 'overview' && (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>{Icons.cube}</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management</h3>
          <p>Specific management features for this category will appear here.</p>
        </div>
      )}
    </div>
  );
}

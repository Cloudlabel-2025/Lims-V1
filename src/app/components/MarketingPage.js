"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icons } from "@/app/components/Icons";
import styles from "./MarketingPage.module.css";

export default function MarketingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [testCount, setTestCount] = useState(3500);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    labName: "",
    testsPerMonth: "1000-5000",
    message: "",
  });

  // Track scrolling to style navigation bar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Determine active plan based on test volume slider
  const getActivePlan = (count) => {
    if (count <= 1500) return "starter";
    if (count <= 10000) return "growth";
    return "enterprise";
  };

  const activePlan = getActivePlan(testCount);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setContactSubmitted(true);
    // Simulating form submission
    setTimeout(() => {
      setFormData({
        name: "",
        email: "",
        labName: "",
        testsPerMonth: "1000-5000",
        message: "",
      });
    }, 1000);
  };

  const closeContactModal = () => {
    setModalOpen(false);
    // Reset success screen after delay
    setTimeout(() => setContactSubmitted(false), 300);
  };

  return (
    <div className={styles.marketingBody}>
      {/* Background glowing effects */}
      <div className={styles.bgGlows} aria-hidden="true">
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.orb3} />
        <div className={styles.gridOverlay} />
      </div>

      {/* Navigation bar */}
      <nav className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ""}`}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.brand}>
            <span className={styles.logoIcon}>{Icons.logo}</span>
            <span>CHC LIMS</span>
          </Link>

          <div className={styles.navLinks}>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); setModalOpen(true); }}>Contact</a>
          </div>

          <div className={styles.navActions}>
            <div className={styles.dropdownWrapper}>
              <button 
                type="button" 
                className={styles.btnSecondary} 
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
              >
                Sign In
                <span style={{ transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s ease" }}>
                  ▼
                </span>
              </button>

              <div className={`${styles.dropdownMenu} ${dropdownOpen ? styles.dropdownOpen : ""}`}>
                <Link href="/login" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                  <span className={styles.dropdownIcon}>{Icons.flask}</span>
                  <div className={styles.dropdownText}>
                    <h4>Tenant Portal</h4>
                    <p>Access your laboratory workspace.</p>
                  </div>
                </Link>
                <div className={styles.dropdownDivider} />
                <Link href="/developer/login" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                  <span className={styles.dropdownIcon}>{Icons.shield}</span>
                  <div className={styles.dropdownText}>
                    <h4>Developer Console</h4>
                    <p>Manage platform and onboarding.</p>
                  </div>
                </Link>
              </div>
            </div>

            <button 
              type="button" 
              className={styles.btnPrimary} 
              onClick={() => setModalOpen(true)}
            >
              Book a Demo
              {Icons.arrowRight}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.heroTag}>
          <span>⚡</span> Introducing Multi-Tenant LIMS V1
        </div>
        <h1 className={styles.heroTitle}>
          The Intelligent Cloud LIMS for <span>Modern Diagnostics</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Register patients, track specimens, customize branding, automate billing, and generate secure verified reports. Build a clinical network on a single, secure database infrastructure.
        </p>

        <div className={styles.heroButtons}>
          <button 
            type="button" 
            className={styles.btnPrimary} 
            onClick={() => setModalOpen(true)}
          >
            Request Custom Access
            {Icons.arrowRight}
          </button>
          <a href="#features" className={styles.btnSecondary}>
            Explore Platform Features
          </a>
        </div>

        {/* Dashboard Live Mockup */}
        <div className={styles.dashboardPreview}>
          <div className={styles.dashboardMockup}>
            <div className={styles.mockHeader}>
              <div className={styles.mockDots}>
                <span />
                <span />
                <span />
              </div>
              <div className={styles.mockAddress}>
                https://apex-labs.lims.store/dashboard
              </div>
              <div className={styles.mockUser} />
            </div>
            <div className={styles.mockGrid}>
              <aside className={styles.mockSidebar}>
                <div className={styles.mockSidebarItem} style={{ width: "100%", height: "16px", marginBottom: "12px" }} />
                <div className={styles.mockSidebarItem} style={{ width: "80%" }} />
                <div className={styles.mockSidebarItem} style={{ width: "70%" }} />
                <div className={styles.mockSidebarItem} style={{ width: "90%" }} />
                <div className={styles.mockSidebarItem} style={{ width: "75%" }} />
                <div className={styles.mockSidebarItem} style={{ width: "60%" }} />
              </aside>
              <main className={styles.mockContent}>
                <div className={styles.mockTitleBar}>
                  <div className={styles.mockSidebarItem} style={{ width: "200px", height: "18px" }} />
                  <div className={styles.mockSidebarItem} style={{ width: "80px", height: "18px" }} />
                </div>
                <div className={styles.mockStats}>
                  <div className={styles.mockStatCard}>
                    <div className={styles.mockStatBar} />
                    <div className={styles.mockStatNumber} />
                  </div>
                  <div className={styles.mockStatCard}>
                    <div className={styles.mockStatBar} />
                    <div className={styles.mockStatNumber} />
                  </div>
                  <div className={styles.mockStatCard}>
                    <div className={styles.mockStatBar} />
                    <div className={styles.mockStatNumber} />
                  </div>
                  <div className={styles.mockStatCard}>
                    <div className={styles.mockStatBar} />
                    <div className={styles.mockStatNumber} />
                  </div>
                </div>
                <div className={styles.mockTable}>
                  <div className={`${styles.mockRow} ${styles.mockRowHeader}`}>
                    <div className={styles.mockCell} />
                    <div className={styles.mockCell} />
                    <div className={styles.mockCell} />
                    <div className={styles.mockCell} />
                  </div>
                  <div className={styles.mockRow}>
                    <div className={styles.mockCell} style={{ width: "60px" }} />
                    <div className={styles.mockCell} style={{ width: "100px" }} />
                    <div className={styles.mockCell} style={{ width: "140px" }} />
                    <div className={styles.mockCell} style={{ width: "40px", backgroundColor: "var(--m-primary)" }} />
                  </div>
                  <div className={styles.mockRow}>
                    <div className={styles.mockCell} style={{ width: "50px" }} />
                    <div className={styles.mockCell} style={{ width: "90px" }} />
                    <div className={styles.mockCell} style={{ width: "160px" }} />
                    <div className={styles.mockCell} style={{ width: "40px" }} />
                  </div>
                  <div className={styles.mockRow}>
                    <div className={styles.mockCell} style={{ width: "70px" }} />
                    <div className={styles.mockCell} style={{ width: "110px" }} />
                    <div className={styles.mockCell} style={{ width: "110px" }} />
                    <div className={styles.mockCell} style={{ width: "40px" }} />
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section id="features" className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>Diagnostic Capabilities</span>
          <h2 className={styles.sectionTitle}>Engineered for High-Performance Labs</h2>
          <p className={styles.sectionSubtitle}>
            A comprehensive suite of tools built to optimize diagnostic operations, ensure tenant isolation, and streamline billing.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          <article className={styles.featureCard}>
            <div className={styles.featureIcon}>{Icons.shield}</div>
            <h3>Tenant Database Isolation</h3>
            <p>Master database scopes subscription permissions, while separate tenant databases guarantee HIPAA-grade isolation of sensitive health records.</p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureIcon}>{Icons.flask}</div>
            <h3>Custom Lab Themes</h3>
            <p>Inject lab-specific branding, customize dashboard colors, upload organization logos, and personalize customer-facing portals instantly.</p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureIcon}>{Icons.users}</div>
            <h3>Patient & Doctor Management</h3>
            <p>Comprehensive patient search, duplicate record prevention, visit histories, referral doctor linkings, and automated medical reports dispatch.</p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureIcon}>{Icons.wallet}</div>
            <h3>Automated Invoicing & Ledgers</h3>
            <p>Generate precise itemized invoices, record diagnostic discounts, track partial payments, settle outstanding dues, and generate account statements.</p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureIcon}>{Icons.report}</div>
            <h3>Verified Digital Reports</h3>
            <p>Customizable layout builders with header logos, dynamic normal ranges, multi-verifier validation safeguards, and encrypted digital signatures.</p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureIcon}>{Icons.clock}</div>
            <h3>Reagents & Inventory Monitoring</h3>
            <p>Register diagnostic consumable items, track critical stock counts, monitor shelf lives, trigger alerts, and map usage directly to processed orders.</p>
          </article>
        </div>
      </section>

      {/* Pricing & Interactive Slider */}
      <section id="pricing" className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>Fair & Flexible Pricing</span>
          <h2 className={styles.sectionTitle}>Scale Dynamically as You Grow</h2>
          <p className={styles.sectionSubtitle}>
            Adjust the slider to match your laboratory volume. The system automatically recommends the perfect tier.
          </p>
        </div>

        {/* Slider control */}
        <div className={styles.pricingCalculator}>
          <div className={styles.calculatorHeader}>
            <h3>Estimate Your Processing Volume</h3>
            <p>Slide the control to match your anticipated monthly processed tests.</p>
          </div>
          <div className={styles.sliderContainer}>
            <input 
              type="range" 
              min="100" 
              max="20000" 
              step="100"
              value={testCount} 
              onChange={(e) => setTestCount(parseInt(e.target.value))}
              className={styles.slider}
              aria-label="Monthly test volume slider"
            />
            <div className={styles.sliderLabel}>
              {testCount.toLocaleString()} <span>tests per month</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className={styles.pricingGrid}>
          {/* Starter Plan */}
          <div className={`${styles.pricingCard} ${activePlan === "starter" ? styles.pricingCardActive : ""}`}>
            <div className={styles.pricingHeader}>
              <h3>Starter Portal</h3>
              <p>Ideal for independent pathlabs starting out.</p>
            </div>
            <div className={styles.pricingPrice}>
              <strong>$99</strong>
              <span>/month</span>
            </div>
            <ul className={styles.pricingFeatures}>
              <li>{Icons.plus} Up to 1,500 tests/month</li>
              <li>{Icons.plus} Single-tenant isolation</li>
              <li>{Icons.plus} Standard patient registry</li>
              <li>{Icons.plus} PDF test reports</li>
              <li>{Icons.plus} Basic billing ledger</li>
            </ul>
            <button 
              type="button" 
              className={activePlan === "starter" ? styles.btnPrimary : styles.btnSecondary}
              onClick={() => setModalOpen(true)}
            >
              Choose Starter
            </button>
          </div>

          {/* Growth Plan */}
          <div className={`${styles.pricingCard} ${activePlan === "growth" ? styles.pricingCardActive : ""}`}>
            {activePlan === "growth" && <span className={styles.popularBadge}>Recommended</span>}
            <div className={styles.pricingHeader}>
              <h3>Growth Suite</h3>
              <p>For expanding, busy clinical centers.</p>
            </div>
            <div className={styles.pricingPrice}>
              <strong>$299</strong>
              <span>/month</span>
            </div>
            <ul className={styles.pricingFeatures}>
              <li>{Icons.plus} Up to 10,000 tests/month</li>
              <li>{Icons.plus} Everything in Starter</li>
              <li>{Icons.plus} Complete inventory tracking</li>
              <li>{Icons.plus} Verified digital signatures</li>
              <li>{Icons.plus} Multiple user roles & permissions</li>
            </ul>
            <button 
              type="button" 
              className={activePlan === "growth" ? styles.btnPrimary : styles.btnSecondary}
              onClick={() => setModalOpen(true)}
            >
              Choose Growth
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className={`${styles.pricingCard} ${activePlan === "enterprise" ? styles.pricingCardActive : ""}`}>
            {activePlan === "enterprise" && <span className={styles.popularBadge}>Enterprise</span>}
            <div className={styles.pricingHeader}>
              <h3>Enterprise Hub</h3>
              <p>For complex multi-site hospital networks.</p>
            </div>
            <div className={styles.pricingPrice}>
              <strong>$899</strong>
              <span>/month</span>
            </div>
            <ul className={styles.pricingFeatures}>
              <li>{Icons.plus} Unlimited monthly tests</li>
              <li>{Icons.plus} Everything in Growth</li>
              <li>{Icons.plus} Multi-lab developer console</li>
              <li>{Icons.plus} Advanced doctor referral reports</li>
              <li>{Icons.plus} SLA uptime guarantees & API access</li>
            </ul>
            <button 
              type="button" 
              className={activePlan === "enterprise" ? styles.btnPrimary : styles.btnSecondary}
              onClick={() => setModalOpen(true)}
            >
              Request Enterprise
            </button>
          </div>
        </div>
      </section>

      {/* CTA Onboarding Section */}
      <section className={styles.section}>
        <div className={styles.ctaBanner}>
          <h2>Ready to Modernize Your Diagnostics?</h2>
          <p>
            Deploy your dedicated LIMS instance in minutes. Securely record patient visits, coordinate referral commission payments, track reagents, and sign reports.
          </p>
          <button 
            type="button" 
            className={styles.btnPrimary} 
            onClick={() => setModalOpen(true)}
          >
            Contact Sales for Provisioning
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Link href="/" className={styles.brand}>
                <span className={styles.logoIcon}>{Icons.logo}</span>
                <span>CHC LIMS</span>
              </Link>
              <p>Providing next-generation Laboratory Information Management infrastructure with dedicated multi-tenant isolation architectures.</p>
            </div>

            <div className={styles.footerLinks}>
              <div className={styles.footerColumn}>
                <h4>Platform</h4>
                <a href="#features">Features</a>
                <a href="#pricing">Pricing</a>
                <Link href="/login">Tenant Portal Login</Link>
              </div>
              <div className={styles.footerColumn}>
                <h4>Operators</h4>
                <Link href="/developer/login">Developer Console</Link>
                <a href="#contact" onClick={(e) => { e.preventDefault(); setModalOpen(true); }}>Support Request</a>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p>&copy; {new Date().getFullYear()} CHC Diagnostics Platform. All rights reserved.</p>
            <div className={styles.footerStatus}>
              <span /> All Systems Operational
            </div>
          </div>
        </div>
      </footer>

      {/* Contact Form Modal */}
      <div 
        className={`${styles.modalOverlay} ${modalOpen ? styles.modalOverlayOpen : ""}`} 
        onClick={closeContactModal}
        aria-modal="true"
        role="dialog"
      >
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <button 
            type="button" 
            className={styles.modalClose} 
            onClick={closeContactModal}
            aria-label="Close modal"
          >
            {Icons.close}
          </button>

          {!contactSubmitted ? (
            <>
              <div className={styles.modalHeader}>
                <h2>Request Diagnostic Demo</h2>
                <p>Submit your details to provision a sandbox LIMS environment.</p>
              </div>

              <form className={styles.modalForm} onSubmit={handleFormSubmit}>
                <div className={styles.formField}>
                  <label htmlFor="modal-name">Full Name</label>
                  <input 
                    type="text" 
                    id="modal-name" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    placeholder="e.g. Dr. Alex Mercer" 
                    required 
                  />
                </div>

                <div className={styles.formField}>
                  <label htmlFor="modal-email">Work Email</label>
                  <input 
                    type="email" 
                    id="modal-email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleInputChange} 
                    placeholder="alex@pathlabs.com" 
                    required 
                  />
                </div>

                <div className={styles.formField}>
                  <label htmlFor="modal-lab">Laboratory Name</label>
                  <input 
                    type="text" 
                    id="modal-lab" 
                    name="labName" 
                    value={formData.labName} 
                    onChange={handleInputChange} 
                    placeholder="City Pathological Laboratories" 
                    required 
                  />
                </div>

                <div className={styles.formField}>
                  <label htmlFor="modal-tests">Monthly Volume</label>
                  <select 
                    id="modal-tests" 
                    name="testsPerMonth" 
                    value={formData.testsPerMonth} 
                    onChange={handleInputChange}
                  >
                    <option value="under-1000">Under 1,000 tests/mo</option>
                    <option value="1000-5000">1,000 - 5,000 tests/mo</option>
                    <option value="5000-10000">5,000 - 10,000 tests/mo</option>
                    <option value="over-10000">Over 10,000 tests/mo</option>
                  </select>
                </div>

                <div className={styles.formField}>
                  <label htmlFor="modal-msg">Special Requirements</label>
                  <textarea 
                    id="modal-msg" 
                    name="message" 
                    value={formData.message} 
                    onChange={handleInputChange} 
                    placeholder="Need custom report configurations, instrument interface details, etc." 
                    rows="3"
                  />
                </div>

                <button type="submit" className={styles.btnPrimary}>
                  Submit Request
                  {Icons.arrowRight}
                </button>
              </form>
            </>
          ) : (
            <div className={styles.successView}>
              <div className={styles.successIcon}>✓</div>
              <h3>Request Submitted!</h3>
              <p>
                Thank you for your interest. A platform architect will reach out to provision your custom LIMS tenant database.
              </p>
              <button 
                type="button" 
                className={styles.btnSecondary} 
                onClick={closeContactModal}
                style={{ width: "120px" }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

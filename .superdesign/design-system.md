# Corporate LIMS Product Design System

## Product context

This is a multi-tenant laboratory information management system used by laboratory staff, administrators, doctors, patients, accountants, and platform developers. Interfaces must optimize operational accuracy, fast scanning, traceability, and calm decision-making. Preserve all existing product behavior, permissions, tenant branding, workflows, and data density.

The approved visual source is the Corporate Subscription & Billing Portal. Extend its restrained enterprise account-portal language consistently across the entire product.

## Brand and visual direction

- Use the existing system UI font stack only: `-apple-system`, BlinkMacSystemFont, `Segoe UI`, sans-serif.
- Primary text: deep navy `#0f172a`; secondary text: slate `#64748b`; muted text: `#94a3b8`.
- Primary action and positive emphasis: teal `#0d9488`; hover/dark teal `#0f766e`; soft teal `#f0fdfa` and `#ccfbf1`.
- Application background: `#f1f5f9`; cards: white; subtle sections: `#f8fafc`.
- Borders: `#e2e8f0`; use 1px borders to establish hierarchy.
- Use amber and red only for warning, critical, destructive, overdue, or blocked states.
- No decorative gradients, glass effects, neon colors, oversized illustrations, serif fonts, or ornamental shadows.
- Prefer 8-12px radii. Use 14-18px only for major dialogs or mobile bottom sheets.
- Shadows must remain subtle and functional: one-pixel card elevation or focused dialog elevation.

## Information hierarchy

- Page headers identify the operational context, title, concise supporting text, current status, and one primary action.
- Use compact executive summaries for key metrics, billing/account information, or workflow state.
- Dense operational information belongs in aligned tables, definition rows, or structured cards—not scattered decorative tiles.
- Numeric values must align and remain comparable. Labels should be concise and unambiguous.
- Use uppercase only for small kickers, column labels, or status metadata.
- Show status with text plus color; never depend on color alone.
- Every data-heavy page must include designed loading, empty, filtered-empty, error, permission-denied, and partial-data states.

## Accessible typography scale

- Browser root remains 16px with text-size adjustment enabled.
- Primary reading text is 13.5px on desktop and 14px on mobile, with at least 1.5 line-height.
- Supporting text is 12.5px. Compact uppercase captions and metadata must never render below 11.5px.
- Form controls and buttons are 13.5px on desktop and 14px on mobile.
- Table body content is 13.5px; column labels are at least 11.5px.
- Do not introduce new 8-11px text declarations. Dense interfaces must gain clarity through spacing and hierarchy rather than unreadably small type.

## Shared application shell

- Desktop: fixed or sticky left navigation, compact sticky topbar, content width constrained for readability while allowing dense data pages to expand.
- Tablet: collapsible navigation with preserved module grouping and visible page identity.
- Mobile: navigation drawer, compact topbar, no permanently occupied sidebar, and clear current-location labeling.
- Preserve real project logo, icons, tenant identity, permission-aware navigation, notifications, search, and account controls.
- Tenant and developer consoles share tokens and interaction patterns but retain clearly different navigation labels and responsibilities.

## Core components

- Buttons: primary teal, secondary white/slate border, tertiary text, destructive red-outline. Minimum 44px touch target on mobile.
- Inputs: 42-44px desktop height, 44-48px mobile height, persistent labels, clear required/error/help states.
- Cards and panels: white, 1px slate border, 8-12px radius, minimal shadow.
- Tables: sticky headers where useful, aligned columns, row actions grouped, clear selection, filtering and pagination.
- Mobile table behavior: convert records into labeled cards or an intentionally scrollable data grid; never create accidental page overflow.
- Drawers and dialogs: focused title, supporting context, scrollable body, sticky action footer, escape/close affordance.
- Mobile dialogs become bottom sheets or full-height panels when content is substantial.
- Forms: sections with clear headings; two-column layouts collapse to one column on phones; sticky save/cancel actions for long forms.
- Tabs and filters: compact, keyboard accessible, with filter count and mobile filter drawer.
- Alerts: concise, contextual, and actionable. Do not use large banners for routine information.

## Responsive requirements

Design and implementation must explicitly support:

- Wide desktop: 1440px and above.
- Standard desktop/laptop: 1024-1439px.
- Tablet: 768-1023px.
- Mobile: 360-767px, including a 390px reference viewport.

At every breakpoint:

- No accidental horizontal page overflow.
- Primary actions remain discoverable.
- Touch targets are at least 44px where practical.
- Typography and density scale without hiding required information.
- Multi-column forms and dashboards stack logically.
- Charts, tables, calendars, and inventory grids receive intentional responsive treatment.
- Sticky elements must not obscure content or each other.
- Safe-area padding is respected on mobile bottom actions.

## Domain-specific patterns

- Patient and doctor directories: search-first layout, compact identity/status columns, accessible row/card actions.
- Registration and edit workflows: clear sections, validation summary, progressive disclosure, safe cancel/back behavior.
- Samples: stage/status visibility, chain-of-custody clarity, high-confidence primary action.
- Reports: release status, patient identity, test result hierarchy, print/download actions without clutter.
- Billing and accounting: aligned currency columns, explicit totals, dates and payment states, audit-friendly actions.
- Inventory: dense but navigable stock views, reorder/expiry warnings, filters, batch details, responsive data-grid strategy.
- Analytics: concise KPI summaries, readable charts, accessible legends, and useful empty states.
- Subscription: retain the approved Corporate Subscription & Billing Portal structure and package comparison workspace.
- Developer console: enterprise platform-management language with clear tenant state, package assignment, destructive-action safeguards, and responsive tables/forms.
- Doctor and patient portals: simplified navigation, privacy-conscious information hierarchy, and touch-first responsive layouts.

## Motion and interaction

- Use short 120-200ms transitions for hover, focus, drawers, and dialogs.
- Respect reduced-motion preferences.
- Avoid decorative animation.
- Never animate clinical, financial, or destructive state changes in a way that delays confirmation.

## Implementation constraints

- Reuse existing React components, inline SVG icons, CSS variables, routing, permissions, and data contracts.
- Do not replace real data with design-only sample content.
- Do not change business logic as part of visual redesign work unless separately authorized.
- Each implementation phase must pass lint, existing automated tests, and breakpoint-specific visual verification.

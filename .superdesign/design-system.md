# LIMS Developer Console Design System

Preserve the existing clinical developer-console identity: white information surfaces on a slate app background, deep navy headings, muted slate supporting text, and teal only for primary actions, focus, selection, and positive emphasis.

Use the system UI font. Headings are compact and heavy, but body text should use normal/medium weight for easy scanning. Prefer 8-12px radii, 1px slate borders, and subtle shadows. Avoid oversized typography, excessive uppercase text, decorative gradients outside primary buttons, and large empty card regions.

For package management, prioritize a compact information hierarchy: package identity and developer-controlled release first; prominent recurring price second; usage limits as three comparable metrics; modules as small readable chips; status and actions consistently aligned. Editing should happen in a focused drawer/modal or clearly separated editor rather than expanding a dense card into a long form.

Responsive behavior: two catalog columns on wide screens, one column below tablet widths, full-width actions on small screens, no horizontal overflow, module chips wrap, metric rows collapse cleanly, and dialogs become bottom-sheet/full-height panels on phones.

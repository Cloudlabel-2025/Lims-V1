# Theme Context

## Compact token summary

- Font: system UI stack (`-apple-system`, BlinkMacSystemFont, Segoe UI, sans-serif)
- Primary: `#0d9488`; light `#14b8a6`; dark `#0f766e`
- Primary surfaces: `#f0fdfa`, `#ccfbf1`, `#99f6e4`
- App surface: `#f1f5f9`; cards: `#ffffff`
- Text: `#0f172a`; secondary: `#64748b`; muted: `#94a3b8`
- Border: `#e2e8f0`; light border: `#f1f5f9`
- Radius: 8px, 12px, 16px, 20px
- Shadows: subtle 1px card shadow; medium 4px elevation; large 10px elevation
- Developer desktop shell: 280px sidebar; content padding 28px; sticky topbar
- Developer cards/panels: white, 1px border, 8px radius, 18-22px padding
- Responsive breakpoints in global CSS collapse grids/forms and turn sidebar into a drawer.

## Raw CSS variables

```css
:root {
  --font-main: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --primary: #0d9488;
  --primary-light: #14b8a6;
  --primary-dark: #0f766e;
  --primary-50: #f0fdfa;
  --primary-100: #ccfbf1;
  --primary-200: #99f6e4;
  --surface: #f1f5f9;
  --surface-card: #ffffff;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --border-light: #f1f5f9;
  --shadow-sm: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
}
```

Raw source: `src/app/globals.css`. For design calls, pass lines 1:80 and 3890:4665 plus the subscription-specific styles after implementation.


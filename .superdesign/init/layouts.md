# Shared Layouts

## Root layout

Path: `src/app/layout.js`

```jsx
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><meta charSet="utf-8" /></head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
```

## Developer layout

Paths: `src/app/developer/layout.js`, `src/app/developer/components/DeveloperLayout.js`

The full source is the existing developer shell: a fixed 280px desktop sidebar, sticky 76px topbar, responsive sidebar drawer, and `developer-content` main region. It renders grouped navigation for Overview, Lab Management, Subscriptions, System, and Account. The active subscription route is `/developer/subscriptions`. The source file is under 900 lines and must be passed whole to design calls.


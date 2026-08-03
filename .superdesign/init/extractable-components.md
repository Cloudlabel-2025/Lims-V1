# Extractable Components

## DeveloperSidebar

- Source: `src/app/developer/components/DeveloperLayout.js`
- Category: layout
- Description: Responsive developer navigation with grouped links and active route.
- Extractable props: activePath, sidebarOpen
- Hardcoded: branding, navigation labels, SVG icon registry, CSS classes

## DeveloperTopbar

- Source: `src/app/developer/components/DeveloperLayout.js`
- Category: layout
- Description: Sticky page title, mobile menu control, and developer identity pill.
- Extractable props: pageTitle, userEmail, sidebarOpen
- Hardcoded: kicker, icons, CSS classes

## DeveloperPanel

- Source: global pattern in `src/app/globals.css`
- Category: basic
- Description: White bordered management panel with title and supporting copy.
- Extractable props: title, description
- Hardcoded: border, radius, shadow, spacing


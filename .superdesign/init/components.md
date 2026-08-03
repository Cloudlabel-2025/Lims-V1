# Shared UI Components

The project uses custom React components and global CSS rather than a component library. The subscription page uses no shared form/card primitive; it composes semantic HTML with the `developer-*` global classes. The reusable developer shell is captured in `layouts.md`.

## ThemeProvider

Path: `src/app/components/ThemeProvider.js`

This component applies CMS theme variables. Its full source should be read directly when a generated design changes theme behavior; the subscription catalog only consumes the resulting CSS variables and does not render this component directly.

## Icons

Path: `src/app/components/Icons.js`

Central inline-SVG icon registry. `DeveloperLayout` consumes `home`, `plus`, `list`, `settings`, `trash`, `user`, `logo`, `logout`, `menu`, and `shield`. Icons must remain the existing project SVGs in implementation.


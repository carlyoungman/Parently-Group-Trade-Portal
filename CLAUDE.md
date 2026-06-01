# CLAUDE.md — Parently Group Trade Portal

Reference for AI-assisted development. Keep the codebase consistent with these conventions.

---

## Project Overview

A Shopify B2B Trade Portal built on **Dawn v15.4.1** with custom React, SCSS, and Liquid enhancements.

- **Store:** `parentlygroup.myshopify.com`
- **Stack:** Shopify Liquid · React 18 (Vite IIFE bundle) · SCSS (Sass) · Vanilla JS · ESLint · Prettier · Stylelint
- **Font:** `nexa` (Adobe Typekit) — loaded from `https://use.typekit.net/tsm6wbz.css` in `layout/theme.liquid`
- **Language:** Plain JavaScript — no TypeScript

---

## Repository Structure

```
layout/           Main Liquid layouts (theme.liquid, password.liquid)
sections/         80+ Shopify section Liquid files
snippets/         Reusable Liquid partials
templates/        Page/customer route JSON templates + custom page templates
assets/           Compiled CSS & JS, plus vanilla JS source files
assets/styles/    SCSS source tree — compiled to assets/theme.css
  utilities/      Variables, mixins, functions (no CSS output)
  base/           Foundational styles (layout, typography, buttons, forms…)
  components/     UI component styles
  sections/       Section-specific styles
  templates/      Template overrides
src/              React source (product-bulk-order.jsx only)
locales/          i18n JSON — en.default.json is primary (17 languages)
config/           settings_schema.json (theme settings schema)
blocks/           Custom theme blocks
```

### Files never to edit directly
- `config/settings_data.json` — gitignored; managed by Shopify admin
- `templates/*.json` — gitignored; managed by Shopify admin

---

## Build & Dev Commands

```bash
npm run dev           # Shopify theme dev + Sass watch (concurrent)
npm run build         # Full build: CSS + JS
npm run build:css     # Sass compile (compressed, production)
npm run build:css:dev # Sass compile (expanded, for debugging)
npm run build:js      # Vite build: src/product-bulk-order.jsx → assets/product-bulk-order.js
npm run watch:css     # Sass watch only
npm run lint          # stylelint + eslint
npm run format        # Prettier (run before every commit)
```

---

## Coding Conventions

### Formatting (Prettier — enforced)

| Setting | Value |
|---|---|
| Semicolons | `true` |
| Quotes | Single in JS/JSX; double in SCSS/CSS |
| Tab width | 2 spaces, no tabs |
| Trailing commas | `es5` |
| Print width | 100 (JS/JSX) · 120 (SCSS/Liquid) · 80 (JSON) |
| Arrow parens | always |
| Line endings | LF |

Run `npm run format` before committing.

### JavaScript / JSX

- **No TypeScript** — use JSDoc for type hints only where the shape is non-obvious
- React 17+ JSX transform — do not `import React from 'react'`
- Functional components only; use hooks for state
- Named exports preferred; default export only for Vite entry files
- Module-level constants: `SCREAMING_SNAKE_CASE`
- Helper functions: `function name() {}` — not arrow constants
- BEM class prefix for the bulk order component: `pbo-` (e.g. `pbo-stepper`, `pbo-stepper--disabled`, `pbo-stepper__btn`)
- All decorative SVGs: `aria-hidden="true" focusable="false"`; functional SVGs: `aria-label="…"`

### Liquid

- Use `{%- liquid -%}` blocks for multi-line logic — keeps templates readable
- Inline `{%- style -%}` blocks for section-specific, ID-scoped CSS (dynamic values from settings)
- Section wrapper IDs: `Section-{{ section.id }}`; block IDs: `Block-{{ section.id }}-{{ block.id }}`
- Group `assign` statements at the top of each `{%- liquid -%}` block
- Use `render` — not the deprecated `include` — for all snippets
- Translatable strings belong in `locales/en.default.json`; never hardcode them in templates

### SCSS

- **Module system:** `@use` only — never `@import`
- **Mobile-first** — write mobile defaults, then override at breakpoints
- **BEM naming:** `.block`, `.block__element`, `.block--modifier`
- **Never hardcode hex colours** — use CSS custom properties (see Colour System below)
- **Never write raw `@media` queries** — always use the mixins:

  ```scss
  @include breakpoint-sm   // ≥ 750px  (tablet)
  @include breakpoint-mid  // ≥ 900px
  @include breakpoint-md   // ≥ 990px  (desktop)
  @include breakpoint-lg   // ≥ 1200px
  @include breakpoint-xl   // ≥ 1400px
  @include short-screen    // max-height 650px
  ```

  **Deprecated — do not use:** `mobile-only`, `tablet-down`, `xs-only`, `xs-sm-only`

- Stylelint enforces: alphabetical properties, lowercase-with-hyphens selectors and custom property names
- New SCSS files go in the relevant sub-folder and must be `@use`'d in `assets/styles/theme.scss`
- Alphabetise CSS properties within each rule block (Stylelint will flag violations)

### File Naming

| Type | Convention |
|---|---|
| SCSS partials | `_kebab-case.scss` — referenced as `@use 'folder/name'` |
| Liquid sections | `kebab-case.liquid` |
| Liquid snippets | `kebab-case.liquid` |
| JS assets | `kebab-case.js` |
| React source | `kebab-case.jsx` |

---

## Design System

### Typography

- **Font family:** `'nexa', sans-serif` — both body and heading
- **Root:** `62.5%` so `1rem = 10px`
- **Body:** `1.4rem`; **Small/caption:** `1.2rem`
- **Heading scale CSS vars:** `--font-supersize: 7.2rem` · `--font-h1: 4.0rem` → `--font-h6: 1.2rem`
- Use `@include fluid-type($var)` for headings that scale with `--font-heading-scale`
- Use `@include caption-text` for labels and small text

### Colour System

All colours are **RGB triplets** and must be used via `rgb(var(--color-*))` or `rgba(var(--color-*), alpha)`. Never hardcode hex values in SCSS.

| Token | Role |
|---|---|
| `--color-foreground` | Body text |
| `--color-background` | Page background |
| `--color-heading` | Heading text |
| `--color-button` / `--color-button-text` / `--color-button-hover` | Primary button |
| `--color-secondary-button` / `--color-secondary-button-text` | Secondary button |
| `--color-badge-background` / `--color-badge-foreground` / `--color-badge-border` | Badges |
| `--color-link` | Links |

Values are injected at runtime by `snippets/css-variables.liquid` from `settings.*`. For buttons on dark/coloured backgrounds use `@include button-white`.

### Spacing Tokens (SCSS variables)

Do not invent values outside this scale:

```
$spacing-xxs: 0.4rem   $spacing-xs:  0.8rem   $spacing-sm:  1.2rem
$spacing-md:  1.6rem   $spacing-lg:  2.4rem   $spacing-xl:  3.2rem
$spacing-xxl: 4.8rem
```

Section/page-level spacing uses CSS vars: `--spacing-sections-desktop`, `--spacing-sections-mobile`, `--page-width`.

### Z-index Scale

```
$z-below: -1  |  $z-base: 0  |  $z-dropdown: 10  |  $z-overlay: 20
$z-modal: 30  |  $z-toast: 40  |  $z-max: 9999
```

### Animation Durations

CSS vars: `--duration-short: 100ms` · `--duration-default: 200ms` · `--duration-medium: 300ms` · `--duration-long: 500ms` · `--duration-extra-long: 600ms` · `--duration-extended: 3s`

SCSS: `$duration-short: 100ms` · `$duration-default: 200ms` · `$duration-long: 500ms`

Always wrap animated rules with `@include reduced-motion` to respect user preferences.

### Border / Radius / Shadow

All driven by CSS custom properties set from Shopify admin settings — never hardcode:

- Radii: `--buttons-radius`, `--inputs-radius`, `--media-radius`, `--text-boxes-radius`, `--badge-corner-radius`
- Borders: `--border-width`, `--border-opacity`, `--border-radius`
- Shadows: `--shadow-horizontal-offset`, `--shadow-vertical-offset`, `--shadow-blur-radius`, `--shadow-opacity`

Use `@include component-border` for standard card/input borders.

### Buttons

| Class | Description |
|---|---|
| `.button` | Primary — dark fill, white text |
| `.button--secondary` | White fill, dark text; hover inverts |
| `.button--tertiary` | Transparent bg, faint border, `--font-small`, 9rem × 3.5rem |

- Min size (primary/secondary): `12rem × 4.5rem`, padding `0 3rem`
- Loading state: `.button.loading` — spinner via `::after`
- Do not remove or override the shadow pseudo-element system on buttons

### Forms

- `.field` + `.field__input` + `.field__label` — floating label pattern
- `.select` + `.select__select`
- `.quantity` — stepper with ±  buttons (4.5rem each)
- Standard input height: `4.5rem`
- Borders and radii via CSS vars (`--inputs-radius`, `--inputs-border-width`)

### Cards

```
.card-wrapper
  └── .card[.card--standard | .card--card | .card--horizontal]
        ├── .card__inner
        ├── .card__media
        ├── .card__content
        └── .card__information
```

Badges: `.badge` — padding `0.5rem 1.3rem`, font `--font-small`, colours via CSS vars.

---

## Vanilla JS Architecture

### Web Components (primary pattern)

All interactive Shopify sections use native Web Components:

```javascript
if (!customElements.get('my-component')) {
  customElements.define('my-component', class MyComponent extends HTMLElement {
    connectedCallback() { /* init */ }
    disconnectedCallback() { /* cleanup — unsubscribe pub/sub */ }
  });
}
```

### Pub/Sub (cross-component communication)

```javascript
// assets/pubsub.js + assets/constants.js
const unsub = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => { /* … */ });
// In disconnectedCallback:
unsub();

publish(PUB_SUB_EVENTS.cartUpdate, data);
```

Event names: `PUB_SUB_EVENTS.cartUpdate`, `quantityUpdate`, `variantChange`, `optionValueSelectionChange`, `cartError`.

### Shopify Cart API

```javascript
// Add items
const res = await fetch('/cart/add.js', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: [{ id: variantId, quantity: qty }] }),
});
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.description ?? 'Failed to add to cart');
}
```

Use `fetchConfig(type)` from `global.js` as the base options for other Shopify API calls.

### Key utilities in `assets/global.js` — use these, do not reinvent

| Utility | Purpose |
|---|---|
| `debounce(fn, wait)` | Delay repeated calls |
| `throttle(fn, delay)` | Rate-limit calls |
| `fetchConfig(type)` | Standard Shopify POST headers |
| `getFocusableElements(container)` | All focusable children |
| `trapFocus(container, el)` / `removeTrapFocus(el)` | a11y focus trap |
| `pauseAllMedia()` | Pause all video/audio |
| `onKeyUpEscape(event)` | Escape key handler |
| `HTMLUpdateUtility.setInnerHTML` | Safe HTML injection (re-runs scripts) |
| `HTMLUpdateUtility.viewTransition` | Animated node replacement |
| `SectionId.parseId` / `parseSectionName` / `getIdForSection` | Section ID utilities |

### Passing data from Liquid to JS

Use `data-*` attributes with JSON strings — never inline `<script>` blocks with raw data:

```liquid
<div data-product="{{ product | json | escape }}"
     data-variant-inventory="{{ variant_inventory | json | escape }}">
```

```javascript
const productData = JSON.parse(el.dataset.product ?? '{}');
const inventoryData = JSON.parse(el.dataset.variantInventory ?? '[]');
```

### Shopify globals (available without import)

`window.Shopify`, `window.routes`, `window.accessibilityStrings`, `PUB_SUB_EVENTS`, `fetchConfig`, `debounce`, `throttle` — all loaded via `<script>` tags in `layout/theme.liquid`.

---

## React Component — product-bulk-order

- **Source:** `src/product-bulk-order.jsx`
- **Build output:** `assets/product-bulk-order.js` (IIFE — runs without a module bundler)
- **Class prefix:** `pbo-` for all component classes (e.g. `pbo-stock--low`, `pbo-stepper__btn`)
- `LOW_STOCK_THRESHOLD = 5` — do not change without updating `getStockStatus` and `StockBadge`
- Colour swatches: add entries to `COLOUR_SWATCH_MAP`, not inline
- Currency: use `formatMoney(pence)` → GBP `£x.xx`
- Run `npm run build:js` after every change before pushing

---

## Shopify-specific Rules

- **Dynamic CSS** (overlay opacity, image padding, per-section colours) belongs in `{%- style -%}` blocks inside the Liquid file — not in static SCSS files
- **Section-scoped styles** use the section ID: `#Section-{{ section.id }} { … }`
- **Schema settings** go in the `{% schema %}` block at the bottom of each section file
- **Translations** belong in `locales/en.default.json` (and mirrored in schema `t:` keys) — never hardcode display strings in Liquid

---

## Accessibility

- `:focus-visible` not `:focus` for keyboard focus rings
- `@include focus-ring` for consistent outline styles
- `@include visually-hidden` for screen-reader-only content
- `@include reduced-motion` for all animated rules
- `@include forced-colors` where colour contrast matters
- `<details>` / `<summary>` for accordions; `<button>` not `<div>` for click targets

---

## Critical Reference Files

| Need | File |
|---|---|
| CSS custom properties / design tokens | `snippets/css-variables.liquid` |
| SCSS variables (breakpoints, spacing, z-index) | `assets/styles/utilities/_variables.scss` |
| SCSS mixins (breakpoints, a11y, layout, buttons) | `assets/styles/utilities/_mixins.scss` |
| SCSS entry point | `assets/styles/theme.scss` |
| Global JS utilities & base classes | `assets/global.js` |
| Pub/Sub system | `assets/pubsub.js`, `assets/constants.js` |
| React bulk order component | `src/product-bulk-order.jsx` |
| Bulk order SCSS | `assets/styles/sections/_product-bulk-order.scss` |
| Theme settings schema | `config/settings_schema.json` |
| Primary i18n strings | `locales/en.default.json` |
| Build pipeline | `package.json`, `vite.config.js` |
| Linting config | `eslint.config.js`, `.stylelintrc.json`, `.prettierrc.json` |

---
name: Apex Precision Automotive
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  data-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system projects precision engineering, high-performance telemetry, and showroom-grade sophistication. Tailored for dealership lot technicians, executive floor managers, and discerning high-end car buyers, the aesthetic balances high-density industrial utility with luxury automotive polish.

Visual execution synthesizes **dark-mode technical minimalism** with **tactile instrument-cluster ergonomics**:
- Obsidian and deep slate foundations replicate carbon composite and anodized cockpit trim.
- High-contrast electric accents channel illuminated digital instrument clusters and dynamic driving modes.
- Visual elements favor strict alignment, micro-borders, calibrated data density, and instantaneous scanability under high-paced showroom or service-bay environments.

## Colors

The palette operates in a default dark mode to emulate high-end vehicle consoles, optimize battery consumption on handheld lot devices, and maximize vehicle photography pop.

- **Primary (`#3B82F6` - Electric Cobalt):** Core interactive triggers, key indicators, active filter toggles, primary workflows.
- **Secondary (`#F59E0B` - Racing Amber):** Low-stock warnings, transit statuses, priority review flags.
- **Tertiary (`#10B981` - Kinetic Emerald):** In-stock confirmation, verified inspection stamps, active revenue margins.
- **Critical Alert (`#EF4444` - Crimson Red):** Sold out markers, overdue hold notices, critical diagnostic alerts.
- **Neutrals & Surfaces:**
  - Canvas Root: `#0F172A` (Obsidian Base)
  - Surface Elevation 1: `#1E293B` (Slate Tier)
  - Surface Elevation 2: `#334155` (Hover / Sub-surface Tier)
  - Structural Borders: `#1E293B` / `#334155` at 60% opacity
  - Type High-Contrast: `#F8FAFC` (Pure Pearl White)
  - Type Subdued: `#94A3B8` (Technical Silver)

## Typography

The typographic hierarchy separates vehicle identity from mission-critical telemetry:

- **Display & Body (`Plus Jakarta Sans`):** Delivers geometric elegance, high legibility across moving environments, and modern automotive sophistication.
- **Telemetry & Technical Specs (`JetBrains Mono`):** Applied strictly to pricing, VINs, odometer counts, tire pressure specs, stock counts, and technical badges. Tabular numerals ensure clean vertical alignment across comparative data sheets and inventory logs.
- High-order headings leverage negative tracking (`-0.02em`) to mirror motorsport branding. Sub-labels and metadata chips feature uppercase tracking (`0.06em`) for rapid identification.

## Layout & Spacing

A mobile-first responsive grid engineered for one-handed yard auditing on phones, transitioning into a high-density cockpit layout on desktop consoles.

- **Mobile (< 768px):** 4-column fluid system. Single-column card stacks with thumb-zone anchored bottom navigation bars, fixed horizontal filter scrollers, and pinned action triggers.
- **Tablet (768px – 1024px):** 8-column layout. Split layout pairing vehicle inventory side-by-side with live vehicle diagnostics or appraisal checklists.
- **Desktop (> 1024px):** 12-column modular grid with fixed collateral sidebars (VIN scanning feeds, quick metrics) and expandable data-table density toggles.
- Spacing follows strict 4px/8px cadences (`0.25rem`, `0.5rem`, `1rem`, `1.5rem`, `2.5rem`) to maintain industrial order across high-density vehicle spec blocks.

## Elevation & Depth

Visual hierarchy uses **tonal layer stacking with razor-thin luminescence**:

- **Layer 0 (Canvas):** Base background `#0F172A`.
- **Layer 1 (Cards, Modules, List Items):** Elevated surface `#1E293B` bounded by a 1px solid border of `rgba(255, 255, 255, 0.08)`.
- **Layer 2 (Overlays, Flyouts, Quick-Inspect Drawers):** Surface `#243248` flanked by low-contrast outlines `rgba(59, 130, 246, 0.25)` to provide an electric ambient perimeter.
- **Layer 3 (Modals, Vehicle 360 Viewers):** Surface `#0F172A` surrounded by a diffused glow: `0 24px 48px -12px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.1)`.
- Heavy drop shadows are omitted in favor of contrast borders, internal surface gradients, and backlit state highlights.

## Shapes

The design system adheres to Level 1 (`Soft`, 4px base radius) to project architectural precision, engineered edges, and vehicle-chassis rigidity:

- **Micro Components (Badges, Tag Pills, Checkboxes):** `4px` (`0.25rem`) radius. Maintains a machined, structural aesthetic rather than toy-like roundness.
- **Container Elements (Vehicle Cards, Modals, Stat Panels):** `8px` (`0.5rem`, `rounded-lg`). Provides subtle perimeter softening while preserving compact grid packing.
- **Trigger Elements (Buttons, Inputs, Selectors):** `6px` (`rounded-md`). Balances industrial touch target affordance with sharp perimeter definition.

## Components

### 1. Vehicle Inventory Cards
- **Structure:** 16:9 vehicle photographic media container with dynamic aspect ratios for 360-rotations. Integrated overlay status tags positioned top-left, quick-favorite trigger top-right.
- **Data Block:** Two-tier typography: Year/Make/Model in `headline-md` (`#F8FAFC`), Trim in `body-sm` (`#94A3B8`). 
- **Telemetry Bar:** JetBrains Mono tabular readout for Odometer, Engine/Drivetrain, and Exterior Color. Price displayed in `data-mono-lg` accented with Electric Cobalt or pure white.
- **Surface:** `#1E293B` background with a `1px` subtle rim light on top border (`rgba(255, 255, 255, 0.12)`).

### 2. Stock Status Pills
- Micro-pill design using uppercase `label-caps` in JetBrains Mono.
- **In Stock:** Kinetic Emerald background tint `rgba(16, 185, 129, 0.12)`, text `#10B981`, leading live pulse dot.
- **Low Stock / Hold:** Racing Amber background tint `rgba(245, 158, 11, 0.12)`, text `#F59E0B`.
- **Sold / Allocation Locked:** Crimson Red background tint `rgba(239, 68, 68, 0.12)`, text `#EF4444`.

### 3. Filter Tags & Instant Facets
- Horizontal touch-scrollable chip array on mobile devices.
- Inactive state: `#1E293B` background, border `1px solid rgba(255, 255, 255, 0.08)`, text `#94A3B8`.
- Active state: `#3B82F6` primary fill, text `#FFFFFF`, clear indicator cross icon.

### 4. Quick Action Triggers & Buttons
- **Primary Action (Purchase, Reserve, Work Order):** `#3B82F6` background, `#FFFFFF` bold type, `6px` radius. Active state produces a subtle ambient glow (`0 0 16px rgba(59, 130, 246, 0.4)`).
- **Secondary Action (Spec Sheet, VIN History):** Transparent fill, `1px` border of `rgba(255, 255, 255, 0.16)`, `#E2E8F0` text, background shifts to `rgba(255, 255, 255, 0.04)` on press.

### 5. Input Fields & VIN Scanners
- Inset dark background (`#0B1120`), border `1px solid #334155`.
- Focus state: Border transitions to `#3B82F6` with a `1px` inset ring. Placeholder text `#64748B`. Integrated trailing camera trigger icon for mobile barcode/VIN OCR lot scanning.

### 6. Admin / Yard Mode Switch
- Tactile rocker toggle with high-visibility amber indicator light. Swapping modes reorganizes cards from customer-facing visual spec view to dealer-dense metrics (wholesale cost, days on lot, floorplan interest fee, battery state).
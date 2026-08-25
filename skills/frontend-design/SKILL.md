---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with intentional typography, cohesive color systems, polished spatial composition, and zero AI slop.
---

# Frontend Design Skill

This skill guides the creation of distinctive, production-grade frontend web interfaces, dashboards, and components.

## When to Apply
- Building, restyling, or refining web UI components, landing pages, dashboards, and layouts.
- Optimizing visual hierarchy, typography, spatial rhythms, and color schemes.
- Elevating UX with refined micro-interactions and mathematically sound layout architectures.

## Guidelines

### 1. Design Direction & Identity
- Commit to a clear, bold visual direction tailored to the product domain.
- Avoid generic "AI slop":
  - Reject default purple-to-blue gradients, cyan text on dark backgrounds, or arbitrary glowing drop shadows.
  - Avoid nested cards inside cards; flatten depth with subtle borders and whitespace.
  - Enforce mathematical corner nesting: `Inner Radius = Outer Radius - Padding`.

### 2. Typography & Readability
- Establish high-contrast hierarchy between display headings and dense body data.
- Ensure minimum body text size of 14–16px with line height of 1.5–1.7 and line lengths constrained to 65–75 characters.
- Ensure all interactive chips, tabs, badges, and button labels fit on a single line without wrapping.

### 3. Spatial Composition & Fluid Layouts
- Design for the full viewport range with fluid responsive layouts.
- Avoid artificial narrow max-width wrappers on administrative management pages and data tables.
- Keep outer container padding equal to or greater than inner component gaps.

### 4. Color & Contrast
- Maintain subtle neutral saturation (<5% HSB) rather than pure unadjusted grayscale.
- Ensure all body text meets WCAG AA (minimum 4.5:1 contrast).
- Never place low-contrast gray text on tinted or colored surfaces.

### 5. Micro-interactions & Motion
- Use subtle, purposeful animations (fade, scale-in, slide-up) for high-impact interactions.
- Provide clear hover, focus, active, and disabled states on all interactive controls.

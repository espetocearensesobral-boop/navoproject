# Project Instructions & Agent Directives

## Frontend Design Skill (Anthropic / High Quality UI Guidelines)

This project adopts the **Frontend Design** standard to ensure production-grade, distinctive, and clean interfaces, avoiding generic "AI slop" or templated defaults.

### 1. Core Principles
- **Intentional Design Thinking**: Understand context, purpose, user hierarchy, and device scale before writing UI code.
- **Distinctive Visual Identity**: Choose deliberate, opinionated styles matched to the domain (barbershop / salon luxury & efficiency) with high readability and contrast.
- **Anti-Slop Directives**:
  - No purple-to-blue generic AI gradients.
  - No cards inside cards without flattened depth.
  - No arbitrary neon glowing borders or generic pill tabs that wrap text.
  - No floating 1px hairline borders mixed with wide soft shadows.
  - No lazy font fallbacks or unmeasured margin bloat.

### 2. Typography & Hierarchy
- Pair distinctive display typography with clean, accessible body text.
- Maintain consistent scale ratios (≥ 1.125 for compact density, ≥ 1.25 for headings).
- Enforce strict line heights (1.5–1.7) and WCAG AA contrast standards.

### 3. Layout, Spacing & Border Math
- **Mathematical Radius Rule**: For any nested element within a rounded container: `Inner Radius = Outer Radius - Distance (Padding)`.
- **Rhythmic Spacing**: Group related inputs tightly and separate major sections with intentional negative space or subtle 1px dividers.
- **Edge-to-Edge Expansion**: Avoid artificial fixed max-widths (`max-w-2xl`, `max-w-3xl`) on administration tables and dashboards; allow full utilization of available screen real estate with appropriate side padding (16–20px).

### 4. Motion & Micro-interactions
- Use smooth, purposeful micro-interactions with `motion/react` or clean Tailwind transitions.
- Every interactive element (buttons, table rows, badges, tabs) must have distinct hover, focus, and active feedback states.

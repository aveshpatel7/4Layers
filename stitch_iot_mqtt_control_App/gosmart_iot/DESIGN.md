---
name: GoSmart IoT
colors:
  surface: '#0f131d'
  surface-dim: '#0f131d'
  surface-bright: '#353944'
  surface-container-lowest: '#0a0e18'
  surface-container-low: '#171b26'
  surface-container: '#1c1f2a'
  surface-container-high: '#262a35'
  surface-container-highest: '#313540'
  on-surface: '#dfe2f1'
  on-surface-variant: '#bbc9cf'
  inverse-surface: '#dfe2f1'
  inverse-on-surface: '#2c303b'
  outline: '#859399'
  outline-variant: '#3c494e'
  surface-tint: '#47d6ff'
  primary: '#a5e7ff'
  on-primary: '#003543'
  primary-container: '#00d2ff'
  on-primary-container: '#00566a'
  inverse-primary: '#00677f'
  secondary: '#43f0a5'
  on-secondary: '#003822'
  secondary-container: '#00d38b'
  on-secondary-container: '#005435'
  tertiary: '#e5d6ff'
  on-tertiary: '#3d008f'
  tertiary-container: '#cdb5ff'
  on-tertiary-container: '#6114d3'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b6ebff'
  primary-fixed-dim: '#47d6ff'
  on-primary-fixed: '#001f28'
  on-primary-fixed-variant: '#004e60'
  secondary-fixed: '#56feb2'
  secondary-fixed-dim: '#2be198'
  on-secondary-fixed: '#002112'
  on-secondary-fixed-variant: '#005233'
  tertiary-fixed: '#eaddff'
  tertiary-fixed-dim: '#d1bcff'
  on-tertiary-fixed: '#24005b'
  on-tertiary-fixed-variant: '#5800c8'
  background: '#0f131d'
  on-background: '#dfe2f1'
  surface-variant: '#313540'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: '0'
  body-bold:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
  stat-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
---

## Brand & Style

The design system for the product is rooted in the "Precision Control" narrative—a visual ecosystem that feels as reliable as industrial hardware yet as sophisticated as high-end consumer electronics. The brand personality is **Smart, Technical, and Dependable**, catering to users who value real-time responsiveness and high-tech aesthetics in their home automation.

The design style is a hybrid of **Modern Corporate** and **Tactile Glassmorphism**. It utilizes a "Dark Cockpit" aesthetic to reduce eye strain and maximize the impact of functional color. UI elements are treated as physical objects with weight; they use subtle inner highlights and outer neon glows to simulate the behavior of mechanical switches with LED backlighting. The emotional response should be one of "Absolute Control"—the user should feel that every tap has a physical consequence.

## Colors

This design system uses a high-contrast dark theme centered around an **Electric Cyan** primary color. This primary is reserved for active power states, focus indicators, and primary navigation cues. 

- **Primary (Electric Cyan):** Symbolizes digital intelligence and energized circuits.
- **Secondary (Tech Green):** Indicates connectivity, stability, and successful operations.
- **Tertiary (Electric Violet):** Used for automation logic, scheduling, and "Scene" management.
- **Neutral (Obsidian Navy):** The foundational layer, providing a deep, non-distracting canvas.

**Color Roles:**
- **Surface:** Components live on a `#121824` surface to distinguish them from the base canvas.
- **On-Surface:** Use `#ECF0F6` for maximum legibility on dark backgrounds.
- **Active State:** When a device is "ON," the component should employ a radial glow using a 15% opacity version of the primary color.

## Typography

The typography system is built exclusively on **Inter** to leverage its geometric precision and clarity. The hierarchy is intentionally "heavy" to ensure legibility on mobile devices under varying lighting conditions.

- **Metrics & Data:** Use `stat-lg` or `display-lg` for real-time sensor data and power readings.
- **Headings:** Use `headline-md` for room names and device categories.
- **Interactive Labels:** Buttons and toggle titles use `body-bold` for immediate recognition.
- **Metadata:** All supplementary information (e.g., WiFi signal, last updated) uses `label-caps` in uppercase with expanded letter-spacing to prevent visual crowding at small scales.

## Layout & Spacing

The design system employs a **Fluid Grid** model optimized for mobile-first interaction. The core layout utilizes a 4-column grid with a fixed **16px margin** on the left and right edges to prevent interactive elements from clipping against hardware bezels.

**Spacing Logic:**
- **8px Grid:** All components and vertical spacing follow an 8px baseline rhythm.
- **Touch Safety:** Interactive elements are separated by at least **16px (md)** to prevent accidental triggers.
- **Dashboard Grid:** Main device controls are typically arranged in a **2x2 grid** using the `gutter` spacing for both horizontal and vertical separation.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layers** and **Neon Ambient Shadows**. Depth is not communicated through traditional grey shadows, but through light-source simulation:

- **Base Layer:** The deepest layer is the root background (`#0B0F19`).
- **Surface Layer:** Inactive cards and containers sit on a slightly elevated `#121824`.
- **Active Layer:** When a state is "Active" (e.g., a switch is ON), the component gains an **Electric Cyan** glow (`#00D2FF` at 20% opacity) with a large blur radius (12-24px).
- **Tactile Inset:** Buttons use a 1px inner highlight on the top edge to create a beveled, physical appearance. When pressed, the element should scale down by 3% to simulate mechanical travel.

## Shapes

The design system uses a **Rounded** shape language to balance high-tech precision with user-friendly approachability. 

- **Standard Cards:** Use `rounded-xl` (1.5rem / 24px) to create large, switch-like interactive areas.
- **Control Elements:** Sliders and small buttons use `rounded-lg` (1rem / 16px).
- **Status Badges:** Use a pill-shaped radius for immediate distinction from interactive containers.
- **Borders:** Containers use a sharp **1px hairline border** (`#1E2C42`) to maintain a clean, architectural structure.

## Components

### Buttons & Switches
- **Dashboard Toggles:** Large cards (80x80px min) with a `rounded-xl` corner. In the ON state, the border transforms to `primary_color_hex` with an outer glow.
- **Tactile Feedback:** All primary buttons must exhibit a `scale(0.97)` transition on active press.

### Status Badges
- **Pill-shaped:** Used for connectivity and firmware statuses.
- **Pulsing States:** For critical processes like "Pairing" or "Updating," the badge border should pulse between its accent color and a 50% dimmed version.

### Input Fields
- **Inset Style:** Inputs should use a darker background (`#080A10`) than the surface they sit on to create an "etched" look. 
- **Focus:** On focus, the border transitions to `primary_color_hex`.

### Domain-Specific: Fan Speed
- **Segmented Control:** Represented as 5 discrete linear blocks. 
- **Illumination:** As speed increases, segments illuminate sequentially from left to right in `primary_color_hex`.

### Domain-Specific: Signal Strength
- **Iconography:** Use a 5-bar vertical chart. High strength uses `secondary_color_hex`; poor strength uses `status_warning_hex`.
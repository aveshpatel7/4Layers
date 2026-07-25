---
name: Lumina Tech
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#cdc3d4'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#978d9d'
  outline-variant: '#4b4452'
  surface-tint: '#dab9ff'
  primary: '#dab9ff'
  on-primary: '#460283'
  primary-container: '#bb86fc'
  on-primary-container: '#4c0f89'
  inverse-primary: '#7743b5'
  secondary: '#dcb8ff'
  on-secondary: '#44186d'
  secondary-container: '#5e3588'
  on-secondary-container: '#d2a5ff'
  tertiary: '#17deca'
  on-tertiary: '#003731'
  tertiary-container: '#00b2a1'
  on-tertiary-container: '#003d37'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eedbff'
  primary-fixed-dim: '#dab9ff'
  on-primary-fixed: '#2a0053'
  on-primary-fixed-variant: '#5e289b'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#dcb8ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#5b3285'
  tertiary-fixed: '#4ffbe6'
  tertiary-fixed-dim: '#17deca'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max: 1440px
---

## Brand & Style
This design system centers on a high-fidelity, futuristic IoT aesthetic that bridges the gap between hardware and software. Inspired by tactile 3D switches and neon-lit environments, the visual language is defined by deep, immersive voids contrasted against vibrant, emissive accents. 

The style is a fusion of **Glassmorphism** and **Tactile Modernism**, utilizing semi-transparent surfaces, subtle inner glows, and soft 3D extrusions. The goal is to evoke a sense of advanced precision and effortless control, making the user feel like they are operating high-end, near-future technology. The emotional response is one of calm authority, sophistication, and technological wonder.

## Colors
The palette is dominated by an "Infinite Black" background to maximize the impact of the neon elements. 

- **Primary & Secondary:** A range of vibrant purples and violets used for active states, interactive highlights, and glow effects.
- **Tertiary:** A sharp teal used sparingly for success states or secondary data streams to provide chromatic variety.
- **Neutrals:** Grays are kept extremely cool and dark, acting as containers that recede into the background.
- **Glow Logic:** Interactive elements should utilize an emissive property, where the color appears to bleed into the surrounding dark space via soft Gaussian blurs.

## Typography
The typographic system prioritizes technical clarity and a "developer-chic" aesthetic. 

- **Geist** is used for large headlines to provide a clean, geometric structure.
- **Inter** handles the bulk of the body text for maximum legibility at various scales.
- **JetBrains Mono** is utilized for all data readouts, status labels, and telemetry, reinforcing the "high-tech" instrumentation feel. 

For display text, a very subtle `0 0 8px` text-shadow using the primary color may be applied to simulate a screen glow.

## Layout & Spacing
The layout follows a **Fluid Grid** model with high internal padding within components to allow the "3D depth" and "glow" enough room to breathe without overlapping.

- **Grid:** 12-column layout for desktop, 4-column for mobile.
- **Density:** Spacious. The design system favors generous margins around interactive components to emphasize their physical presence as "hardware-like" objects.
- **Alignment:** Elements should be strictly aligned to a 4px baseline grid to maintain the precision expected of an IoT interface.

## Elevation & Depth
Depth is created through a combination of **Tonal Layering** and **3D Skeuomorphism**:

1.  **Base Layer:** The deepest black (#050505).
2.  **Container Layer:** Slightly elevated (#1A1A1A) with a 1px inner border of `rgba(255,255,255,0.05)` to define the edge.
3.  **Active Elements:** Use "Inner Shadows" to create a recessed effect (wells) and "Drop Shadows" with a primary color tint to create floating or "on" states.
4.  **Glassmorphism:** Overlays and modals use a backdrop blur (20px) with a semi-transparent dark fill to maintain context of the dashboard underneath.

## Shapes
The shape language is "Squircle" based—avoiding harsh geometric corners but staying away from overly bubbly circles. 

- **Standard UI Elements:** Use a 0.5rem (8px) radius for buttons and input fields.
- **Cards/Modules:** Use a 1rem (16px) radius to soften the technical edge.
- **Interactive Toggles:** Follow the pill-shape (full round) of the reference switch to indicate a "handle" or "physical" component.

## Components
- **The Lumina Switch:** Replicate the 3D toggle from the reference. When "ON", the toggle should emit a purple glow that spills onto the track. Use a gradient transition from deep gray to vibrant violet.
- **Glass Cards:** Dashboard modules should have a subtle 1px stroke (linear gradient from top-left white-alpha to bottom-right transparent) to simulate a glass edge catching light.
- **Buttons:** Primary buttons use a solid violet fill with a `0 0 15px` glow. Secondary buttons use an outline with the same glow property on hover.
- **Data Visualizations:** Charts and graphs should use "glow lines"—thin strokes with a soft outer blur in primary or tertiary colors.
- **Input Fields:** Recessed "well" look using an inner shadow to make the field feel carved into the interface.
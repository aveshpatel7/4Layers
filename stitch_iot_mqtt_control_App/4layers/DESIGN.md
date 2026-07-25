---
name: 4Layers
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
  on-surface-variant: '#bccbb9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#4ae176'
  primary: '#4be277'
  on-primary: '#003915'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#006e2f'
  secondary: '#ffb3ad'
  on-secondary: '#68000a'
  secondary-container: '#a40217'
  on-secondary-container: '#ffaea8'
  tertiary: '#afc7ff'
  on-tertiary: '#002e6a'
  tertiary-container: '#82abff'
  on-tertiary-container: '#003d88'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3ad'
  on-secondary-fixed: '#410004'
  on-secondary-fixed-variant: '#930013'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The brand personality of the design system is professional, technical, and high-performance, specifically tailored for a modern IoT (Internet of Things) ecosystem. It targets power users and smart-home enthusiasts who value efficiency, security, and clarity.

The visual style is **Corporate / Modern** with a technical edge. It utilizes a deep dark mode to reduce eye strain during evening use and focuses on high-contrast accent colors to indicate system status and primary actions. The aesthetic is clean and functional, prioritizing information density and immediate legibility of device data.

## Colors
The palette is built on a "True Dark" foundation to emphasize the glow of smart device status indicators.

- **Primary**: Vibrant Green (#22c55e) used for active states, success notifications, and primary action buttons.
- **Secondary (Destructive)**: Red (#ef4444) reserved exclusively for logout, deletions, and critical error alerts.
- **Surface**: The background uses a deep black (#0a0a0a), while containers and cards use a slightly elevated dark gray (#171717) to provide subtle depth.
- **Content**: Pure white (#ffffff) for primary headlines and high-emphasis text; light gray (#a3a3a3) for labels, metadata, and secondary content.

## Typography
The design system uses **Hanken Grotesk** as the primary typeface for its sharp, contemporary feel and excellent legibility in dark mode. For technical data, version numbers, and small labels, **JetBrains Mono** is employed to evoke a "dev-tools" aesthetic appropriate for IoT management.

Headlines should always use a bold or semi-bold weight to ensure they punch through the dark background. Body text maintains a comfortable line height for readability of logs and device settings.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a consistent 4px baseline. 

- **Mobile**: A single-column layout with 16px side margins. Components span the full width of the content area.
- **Desktop/Tablet**: A 12-column grid system. Settings and profile cards typically occupy a centered 6-column span or a sidebar-main configuration.
- **Density**: The system uses a "Compact-Comfortable" hybrid. Spacing between related fields (e.g., Label and Input) is 8px (sm), while spacing between sections (e.g., Profile and Security) is 32px (xl).

## Elevation & Depth
In this design system, depth is communicated through **Tonal Layers** rather than heavy shadows.

- **Level 0 (Base)**: The background of the application (#0a0a0a).
- **Level 1 (Surface)**: Cards and container elements (#171717).
- **Level 2 (Active)**: Elements being hovered or interacted with, indicated by a subtle border (#262626) or a 1px solid stroke.

Shadows are used sparingly, only on floating modals or dropdowns, using a high-blur, low-opacity black shadow to maintain the clean, technical look.

## Shapes
This design system utilizes a **Rounded** shape language to balance the technical "hard" edges of the color palette. 

Standard components like buttons and cards use a 0.5rem (8px) corner radius. This creates a modern, accessible feel that differentiates it from purely industrial interfaces. Icons should follow a similar rounded geometry to remain cohesive with the container shapes.

## Components
- **Buttons**: Primary buttons are solid green (#22c55e) with black text. Destructive buttons (Logout) use a 1px red outline (#ef4444) with red text to denote danger without dominating the visual hierarchy.
- **Cards/Containers**: These should have a background of #171717 and a subtle padding of 16px or 24px.
- **Input Fields**: Backgrounds should be slightly darker than the card surface or matching the base background. Labels must be placed above the field in a light gray (#a3a3a3).
- **Icons**: Icons for section headers (like the Profile user icon or Security lock) should use the Primary Green color to serve as visual anchors.
- **Navigation**: The bottom navigation bar uses a dark translucent background with active items highlighted in Green.
- **Status Chips**: Use Green for "Online/Active," Amber for "Warning," and Red for "Offline/Error."
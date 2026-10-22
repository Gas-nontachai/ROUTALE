# GPX Pixel Adventure UI

This is the implementation reference for the existing product. Keep its forest green and cream identity, existing map provider and single playback timeline.

## Shared foundations

- Use semantic Tailwind colors from `src/index.css`: canvas, surface, surface-muted, foreground, muted, line, primary/on-primary, accent/accent-foreground and danger/danger-surface. Light and dark modes map the same roles to different values.
- Use the bundled Kanit family, regular 400 through bold 700. No external font requests.
- Page titles: 24–30 px; section titles: 18 px; body: 14–16 px; labels and supporting copy: at least 12 px. Numeric metrics use tabular figures.
- Use 4/8 px spacing increments, 12 px button/field groups, 16–24 px section padding and 20–24 px section gaps. App gutters grow from 12 px on phones to 24 px on desktop.
- Use 8 px radii for controls/notices and 12 px for panels/maps. Keep shadows subtle.

## Components and interactions

- Reuse `Button`: primary for the principal action, outline for secondary actions, soft for inactive chart tabs, ghost for navigation. Buttons have at least 44 px height; icon controls are 44 × 44 px.
- Keep a visible focus ring, meaningful names for icon controls, keyboard tab navigation and reduced-motion support. Keep pressed-state feedback within stable layout bounds.
- `.ui-panel` is the shared analysis/card surface; `.ui-notice` is the shared informational state. Loading has live text, a spinner and disabled duplicate actions. Error states use danger tokens.
- Chart colors encode metrics rather than application surfaces; axes, grids and tooltips follow the active theme. Missing data remains a gap.
- The map imagery and dark translucent map toolbar retain their existing map-specific visual treatment. Settings panels follow application theme tokens.

## Responsive composition

- Import: one focused upload panel, primary file action and secondary existing sample-trail action.
- Playback: route fills available height; controls wrap and timeline moves to a full-width row on phones. Short landscape windows can scroll rather than conceal controls.
- Summary: one shared map; three primary metrics, two-column secondary statistics on narrow layouts, analysis and splits below. Available height is used on mobile instead of a fixed short map viewport. Replay stays visible in Summary.
- Avoid horizontal page overflow. Tables can scroll within their own panel. Labels and long activity names must not force the viewport wider.

## Verification

Theme text pairs have automated 4.5:1 contrast checks. Button tests cover safe default type, explicit submit, loading and composed links. Browser checks cover light/dark Import, real sample worker import, Preview, Play/Pause, Summary, keyboard chart tabs and Replay, with widths 375, 768, 1024 and 1440 px plus 812 × 375 landscape. Responsive checks measured no horizontal page overflow; replay released the Summary map, leaving one playback map canvas.

`ui-ux-pro-max` informed accessibility, contrast, shared tokens, responsive sizing and interaction consistency. Its generated landing-page patterns and alternate palettes were not applied because they did not match the established product. No generated search output was persisted as a product decision.

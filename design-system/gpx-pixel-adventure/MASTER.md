# Routale UI — The Living Atlas

Formerly GPX Pixel Adventure; the legacy directory is retained to avoid breaking references.

## Foundations

Use semantic tokens in src/index.css and the bundled Kanit 400–700 fonts. Canvas #FAF9F4, Ink #182E36, Trail Green #2B8C6B, Orange #F28B39, Violet #7855B2, Berry #B65271, Lake Blue #438BB7. Text/button roles use contrast-adjusted green (#237557) and theme-specific foregrounds. Kanit OFL is available in public/licenses. No remote fonts, GSAP or Storybook.

Use restrained borders, small control radii and editorial section rules. Avoid giant cards and decorative gradients. Data uses tabular numerals. Base copy 14–16px, supporting labels at least 12px. Buttons and icon tools are at least 44px. Reuse Button variants: primary, energy, secondary, outline, danger; preserve native disabled and focus semantics.

## Composition

Navbar: wordmark, optional Beta and theme only. Footer: promise and native Licenses & map credits dialog. Inline MapLibre attribution remains on both maps.

Home: two-column headline/import and local Figma SVG; single-column on mobile. Click/drop use the same worker validation with loading/error/retry. GPX is local; map geography requests are explained. SVG is the supplied Figma Home asset, not an activity data illustration.

Journey: compact identity, dominant live map, transparent distance numerals with a white text halo. Five map tools always visible. Native title tooltips and accessible names. Camera/layer actions require user camera ownership; Pause is explained. Settings stay open until dismissed, with Escape/close focus restoration. Simulation engine remains the only playback clock. Dock respects bottom safe area.

Summary: identity/actions, primary facts, overview map/details, optional technical disclosure, Explore the Data and splits. Missing measurements use dashes or are omitted. New import clears session; Replay reuses parsed route.

Chart: Elevation, Pace, Heart rate, Temperature, Gradient, when available. Checkboxes; one physical axis, two physical axes, 3–5 metrics normalize each metric to 0–100%. Higher pace means slower movement; flat trends center at 50%. Distance alignment uses original source coordinates, with existing gap/extrema-preserving decimation. Actual units in popup and screen-reader announcements. Pointer/touch, click pin, keyboard arrows/Home/End/Enter/Escape. Chart state remains local and does not rerender the map on pointer movement.

Splits: real pipeline values; partial label; fastest ranking excludes partial and unavailable pace. No optional pace bars.

## Verification

Use npm test, npm run build, npm run knip and npm run format:check. Theme tests enforce 4.5:1 foreground pairs, including energy buttons. Review mobile/desktop and light/dark. See docs/routale/IMPLEMENTATION_CHECKLIST.md for actual current browser evidence and remaining release limits; do not infer verification from design specimens.

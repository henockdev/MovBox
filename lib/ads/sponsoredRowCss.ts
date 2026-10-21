/**
 * Styles for the in-feed sponsored card row.
 *
 * WHY THIS IS A STRING AND NOT A .css FILE
 * ---------------------------------------
 * ExoClick re-skins its widget with `!important` rules scoped to a random
 * per-load id it mints itself (`#msg-native-widget-6054480-fNqra`, and it
 * changes every request). That lands at specificity (1,2,0).
 *
 * Our selectors below are `#movbox-sponsored-ads .msg-native-widget`, which
 * is ALSO (1,2,0). When two `!important` declarations have equal
 * specificity, source order decides — and ExoClick injects its stylesheet at
 * runtime into <head>, i.e. BEFORE the body. So a bundled .css file loses
 * the tie no matter how it is written.
 *
 * Rendering this as a <style> element inside the body puts it after
 * ExoClick's, which wins the tie outright. Keep it in the component and do
 * not "tidy" it back into a stylesheet import — the theming silently
 * reverts.
 *
 * The visual target is components/home/MovieCard.tsx: same widths, same
 * 2:3 poster ratio, same radius/border/hover lift, same title+meta stack.
 * If MovieCard's design tokens change, change these to match.
 */

export const SPONSORED_ROW_CSS = `
#movbox-sponsored-ads {
  display: block;
  width: 100%;
}

#movbox-sponsored-ads .msg-native-widget,
#movbox-sponsored-ads .exo-native-widget {
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  background: transparent !important;
  border: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  /* Never let the CDN's own font leak in. Explicit stack, not \`inherit\`,
     which resolves straight back to their Arial. */
  font-family: var(--font-inter), Inter, system-ui, -apple-system, "Segoe UI",
    Roboto, sans-serif !important;
}

/* The row itself: identical geometry to MovieRow's scroller so the ad
   cards line up pixel-for-pixel with the real cards in the rows above and
   below it. */
#movbox-sponsored-ads .msg-native-widget-outer-container,
#movbox-sponsored-ads .msg-native-widget-items {
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: flex-start !important;
  gap: 0.375rem !important;
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  padding: 0 0 0.5rem !important;
  margin: 0 !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
  grid-template-columns: none !important;
  grid-auto-flow: unset !important;
  float: none !important;
}
#movbox-sponsored-ads .msg-native-widget-outer-container::-webkit-scrollbar,
#movbox-sponsored-ads .msg-native-widget-items::-webkit-scrollbar {
  display: none;
}

/* Per-card slot: mirrors MovieCard's w-[100px] sm:128 md:148 lg:168. */
#movbox-sponsored-ads .msg-native-widget-item-container {
  flex: 0 0 auto !important;
  width: 100px !important;
  min-width: 0 !important;
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
  position: relative !important;
  float: none !important;
  display: block !important;
}

/* The card itself: MovieCard's poster box. */
#movbox-sponsored-ads .msg-native-widget-item {
  display: block !important;
  position: relative !important;
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 2 / 3 !important;
  overflow: hidden !important;
  border-radius: 6px !important;
  border: 1px solid #302022 !important;
  background: #140d0e !important;
  box-shadow: none !important;
  cursor: pointer !important;
  transform: translateZ(0) !important;
  transition: transform 300ms ease, border-color 300ms ease,
    box-shadow 300ms ease !important;
}

@media (min-width: 640px) {
  #movbox-sponsored-ads .msg-native-widget-outer-container,
  #movbox-sponsored-ads .msg-native-widget-items {
    gap: 0.5rem !important;
  }
  #movbox-sponsored-ads .msg-native-widget-item-container {
    width: 128px !important;
  }
}
@media (min-width: 768px) {
  #movbox-sponsored-ads .msg-native-widget-outer-container,
  #movbox-sponsored-ads .msg-native-widget-items {
    gap: 0.75rem !important;
  }
  #movbox-sponsored-ads .msg-native-widget-item-container {
    width: 148px !important;
  }
}
@media (min-width: 1024px) {
  #movbox-sponsored-ads .msg-native-widget-outer-container,
  #movbox-sponsored-ads .msg-native-widget-items {
    gap: 0.875rem !important;
  }
  #movbox-sponsored-ads .msg-native-widget-item-container {
    width: 168px !important;
  }
}

/* Hover lift — identical easing/scale to MovieCard's group-hover. */
#movbox-sponsored-ads .msg-native-widget-item:hover {
  transform: scale(1.025) !important;
  border-color: #a42e4a !important;
  box-shadow: 0 0 24px -6px rgba(164, 46, 74, 0.55) !important;
}

/* Creative art. ExoClick uses both <img> and background-image divs
   depending on the format, so cover both. */
#movbox-sponsored-ads .msg-native-widget-item img {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: none !important;
  object-fit: cover !important;
  object-position: center !important;
  border-radius: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  float: none !important;
  transition: transform 500ms ease !important;
}
#movbox-sponsored-ads .msg-native-widget-item:hover img {
  transform: scale(1.05) !important;
}

#movbox-sponsored-ads .msg-native-widget-item-image,
#movbox-sponsored-ads .msg-native-widget-item-icon,
#movbox-sponsored-ads .msg-native-widget-item-thumb {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  background-size: cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  border-radius: 0 !important;
}

/* The text block normally sits BELOW the art in normal flow, which puts it
   outside a 2:3 card that clips overflow — the title's "bottom: 0" then
   anchors to this box instead of to the card and gets clipped away.
   Stretching it over the whole card re-anchors the title to the card's
   own bottom edge, which is where MovieCard's title stack belongs. */
#movbox-sponsored-ads .msg-native-widget-item-content {
  position: absolute !important;
  inset: 0 !important;
  z-index: 3 !important;
  width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
  background: transparent !important;
  overflow: visible !important;
  display: block !important;
  float: none !important;
  pointer-events: none !important;
}

/* Text block — sits under the art, like MovieCard's title/meta stack. */
#movbox-sponsored-ads .msg-native-widget-item-title {
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 2 !important;
  display: block !important;
  padding: 1.75rem 0.4rem 0.4rem !important;
  margin: 0 !important;
  background: linear-gradient(
    to top,
    rgba(8, 6, 6, 0.95) 0%,
    rgba(8, 6, 6, 0.72) 55%,
    rgba(8, 6, 6, 0) 100%
  ) !important;
  color: #f8f0e8 !important;
  font-family: var(--font-inter), Inter, system-ui, -apple-system, "Segoe UI",
    Roboto, sans-serif !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  line-height: 1.25 !important;
  text-align: left !important;
  text-transform: none !important;
  text-decoration: none !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  border: 0 !important;
  border-radius: 0 !important;
  background-image: none !important;
}

#movbox-sponsored-ads .msg-native-widget-item-brand,
#movbox-sponsored-ads .msg-native-widget-item-description,
#movbox-sponsored-ads .msg-native-widget-item-subtitle {
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0.22rem !important;
  z-index: 3 !important;
  padding: 0 0.4rem !important;
  color: #b9a9a5 !important;
  font-family: var(--font-inter), Inter, system-ui, -apple-system, "Segoe UI",
    Roboto, sans-serif !important;
  font-size: 9px !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  text-align: left !important;
  text-transform: uppercase !important;
  letter-spacing: 0.06em !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* AdChoices / disclosure stays — it is required and it is also the only
   thing that tells a careful user the card is not a movie. */
#movbox-sponsored-ads .msg-native-widget-item-adchoices,
#movbox-sponsored-ads .msg-adchoices-icon,
#movbox-sponsored-ads [class*="adchoices"] {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: absolute !important;
  right: 3px !important;
  top: 3px !important;
  z-index: 4 !important;
  width: auto !important;
  height: auto !important;
  max-width: 16px !important;
  max-height: 16px !important;
}

/* Their house chrome (big "Ads by ExoClick" strip) would break the
   illusion and the row rhythm — we label the row ourselves. */
#movbox-sponsored-ads .msg-native-widget-header,
#movbox-sponsored-ads .msg-native-widget-footer {
  display: none !important;
}

@media (prefers-reduced-motion: reduce) {
  #movbox-sponsored-ads .msg-native-widget-item,
  #movbox-sponsored-ads .msg-native-widget-item img {
    transition: none !important;
  }
  #movbox-sponsored-ads .msg-native-widget-item:hover {
    transform: none !important;
  }
}
`;
/**
 * Floating glass tab bar — dimension and styling constants.
 *
 * All values are in device-independent pixels (dp).
 * Changing these will affect both the tab bar itself and any screen
 * content that reserves bottom padding via {@link TAB_BAR_TOTAL_HEIGHT}.
 */

/** Height of the pill-shaped tab bar (dp). */
export const TAB_BAR_HEIGHT = 60;

/** Spacing between the bottom safe-area edge and the tab bar (dp). */
export const TAB_BAR_BOTTOM_MARGIN = 12;

/** Horizontal inset from screen edges — keeps the pill centred (dp). */
export const TAB_BAR_HORIZONTAL_MARGIN = 30;

/** Corner radius — set to half the height to produce a perfect pill shape. */
export const TAB_BAR_BORDER_RADIUS = TAB_BAR_HEIGHT / 2;

/** Icon size passed to each tab's `tabBarIcon` render function (dp). */
export const TAB_BAR_ICON_SIZE = 22;

/** Font size for the tab label text (dp). */
export const TAB_BAR_LABEL_SIZE = 10;

/**
 * Total vertical space the tab bar occupies (height + bottom margin).
 * Screen content should reserve this much bottom padding so it isn't
 * hidden behind the floating tab bar.
 */
export const TAB_BAR_TOTAL_HEIGHT = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN;

// ── Colour tokens ──────────────────────────────────────────────────

/** Icon/label colour for the active tab in dark mode. */
export const TAB_BAR_ACTIVE_COLOR_DARK = "#FAFAFA";

/** Icon/label colour for inactive tabs in dark mode. */
export const TAB_BAR_INACTIVE_COLOR_DARK = "#71717A";

/** Icon/label colour for the active tab in light mode (unused currently). */
export const TAB_BAR_ACTIVE_COLOR_LIGHT = "#18181B";

/** Icon/label colour for inactive tabs in light mode (unused currently). */
export const TAB_BAR_INACTIVE_COLOR_LIGHT = "#A1A1AA";

/** Subtle white border around the pill for the glass-edge effect. */
export const TAB_BAR_BORDER_COLOR = "rgba(255, 255, 255, 0.12)";

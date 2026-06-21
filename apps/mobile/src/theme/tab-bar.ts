// Geometry for the floating, Instagram-style Liquid Glass tab bar. Shared between the tab
// navigator (which draws the bar in app/(tabs)/_layout.tsx) and the NowPlaying mini-player
// (which floats just above the bar in src/components/NowPlaying.tsx), so the two stay aligned
// from one source of truth instead of each reconstructing the bar height by hand.

// The floating pill's fixed height. With labels hidden the bar only needs room for the icons,
// so this is a touch shorter than the old full-width bar and reads as a compact capsule.
export const TAB_BAR_HEIGHT = 60;

// Horizontal gap from the screen edges, so the bar floats as a detached pill instead of
// spanning edge to edge. Roomy, like Instagram's bar.
export const TAB_BAR_SIDE_MARGIN = 20;

// Smallest gap between the pill and the screen's bottom edge, used on devices with no home
// indicator (zero bottom inset) so the bar never sits flush against the edge.
const TAB_BAR_MIN_BOTTOM = 12;

// Distance from the screen's bottom edge to the BOTTOM of the floating pill. On devices with a
// home indicator we rest on the safe-area inset; otherwise we lift by TAB_BAR_MIN_BOTTOM.
export function tabBarBottomOffset(bottomInset: number): number {
	return Math.max(bottomInset, TAB_BAR_MIN_BOTTOM);
}

// Distance from the screen's bottom edge to the TOP of the floating pill. The mini-player uses
// this to position itself just above the bar.
export function tabBarTopOffset(bottomInset: number): number {
	return tabBarBottomOffset(bottomInset) + TAB_BAR_HEIGHT;
}

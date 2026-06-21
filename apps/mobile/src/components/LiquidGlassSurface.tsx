import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { StyleSheet, View } from "react-native";

// Whether this OS/build can render Apple's Liquid Glass material. It depends on the iOS version
// (26+) and the SDK the app was built with, neither of which change while the app is running, so
// we resolve it once at module load rather than on every render.
const LIQUID_GLASS = isLiquidGlassAvailable();

export const liquidGlassAvailable = LIQUID_GLASS;

// A frosted background that fills its parent and clips itself to `radius`. On iOS 26+ it uses
// Apple's Liquid Glass (GlassView); everywhere else (older iOS, Android) it falls back to the
// same expo-blur frost the app used before, so the bar still reads as a translucent surface.
//
// Render this as the FIRST child of an opaque-bordered container and keep that container (and its
// ancestors) at full opacity: Liquid Glass renders incorrectly when it, or an ancestor, is faded
// below 1, so never wrap this in an animated opacity.
export function LiquidGlassSurface({
	radius,
	isDark,
	borderColor,
}: {
	radius: number;
	isDark: boolean;
	// Hairline edge for the blur fallback only; Liquid Glass draws its own edge so it is skipped
	// there. Pass the theme border color to define the floating bar against busy content.
	borderColor?: string;
}) {
	if (LIQUID_GLASS) {
		return (
			<GlassView
				glassEffectStyle="regular"
				// The app drives dark mode itself (Uniwind), not the system scheme, so pin the glass
				// appearance to the active theme; otherwise it would frost light over a dark UI (or
				// vice versa) until the OS scheme happened to match.
				colorScheme={isDark ? "dark" : "light"}
				style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
			/>
		);
	}

	return (
		<View
			style={[
				StyleSheet.absoluteFill,
				{
					borderRadius: radius,
					borderCurve: "continuous",
					overflow: "hidden",
					borderWidth: borderColor ? StyleSheet.hairlineWidth : 0,
					borderColor,
				},
			]}
		>
			<BlurView
				tint={isDark ? "dark" : "light"}
				intensity={100}
				style={StyleSheet.absoluteFill}
			/>
		</View>
	);
}

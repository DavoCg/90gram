import { useEffect, useState } from "react";
import {
	type LayoutChangeEvent,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
	cancelAnimation,
	Easing,
	Extrapolation,
	interpolate,
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { Text } from "../text";
import type { TextProps } from "../text/text-types";

type MarqueeTextProps = Omit<TextProps, "children" | "numberOfLines"> & {
	/** The text to display. Marquees only when it overflows the available width. */
	children: string;
	/** Scroll speed in pixels per second. */
	speed?: number;
	/** Gap between the looping copies, in pixels. Also the seamless loop distance. */
	spacing?: number;
	/** Width of the fade mask at each extremity, in pixels. */
	fadeWidth?: number;
	/** Pause held at the start position before each scroll pass, in ms. */
	pause?: number;
	/** When true, snap the title back to its rest position and stop scrolling until cleared. */
	paused?: boolean;
	/** Style applied to the outer container (e.g. `{ flexShrink: 1 }` inside a row). */
	containerStyle?: StyleProp<ViewStyle>;
};

// The hidden measurer reports the text's INTRINSIC single-line width, which drives the overflow
// decision. React Native measures a Text within the available width its parent hands down and
// truncates a numberOfLines={1} Text to it, so the measurer MUST be given effectively unbounded
// width: a wide, fixed-width absolute row whose Text child (flexShrink: 0) sizes to its content.
const MEASURE_MAX_WIDTH = 100000;
const MEASURE_WRAP: StyleProp<ViewStyle> = {
	position: "absolute",
	left: 0,
	top: 0,
	width: MEASURE_MAX_WIDTH,
	flexDirection: "row",
	opacity: 0,
};

/**
 * A single-line title that infinitely scrolls (marquee) when it is wider than the space it is
 * given, with a gradient fade at each extremity via a MaskedView. The mask is a static both-side
 * gradient; an opaque "cover" inside the mask hides the LEFT fade while the title rests at its
 * start (so the beginning is fully readable, aligned at the left edge) and slides off as the text
 * scrolls, revealing the left fade. The right fade is always on. When the text fits it renders
 * statically with no mask and no animation. Used by both the mini-bar and the full player. All
 * motion runs on the UI thread (a single Reanimated `translateX`, plus a derived cover offset).
 */
export function MarqueeText({
	children,
	speed = 40,
	spacing = 48,
	fadeWidth = 16,
	pause = 4000,
	paused = false,
	containerStyle,
	style,
	...textProps
}: MarqueeTextProps) {
	const [containerWidth, setContainerWidth] = useState(0);
	const [textWidth, setTextWidth] = useState(0);
	const [textHeight, setTextHeight] = useState(0);
	const offset = useSharedValue(0);

	const overflowing =
		containerWidth > 0 && textWidth > 0 && textWidth > containerWidth + 0.5;

	useEffect(() => {
		cancelAnimation(offset);
		if (!overflowing) {
			offset.value = 0;
			return;
		}

		// Paused (e.g. the sound is paused): glide the title back to its rest position and hold it
		// there. It must NOT keep scrolling while playback is stopped; the loop resumes from the
		// start once `paused` clears. ReduceMotion.Never keeps the short return animation even with
		// the OS setting on, so it does not jump.
		if (paused) {
			offset.value = withTiming(0, {
				duration: 350,
				easing: Easing.out(Easing.cubic),
				reduceMotion: ReduceMotion.Never,
			});
			return;
		}

		offset.value = 0;

		// One copy + the gap scrolls past; the second copy sits exactly where the first
		// started, so the reset back to 0 is seamless and the loop never visibly jumps.
		// Each iteration holds at the start (`withDelay(pause)`) before scrolling, and withRepeat
		// snaps the offset back to 0 between iterations, so the same pause covers both the initial
		// wait and the wait after the text returns to its original position.
		// ReduceMotion.Never: a marquee is functional (it reveals clipped text), not decorative,
		// so it must keep looping even when the OS "Reduce Motion" setting is enabled — otherwise
		// withRepeat plays exactly once and stops.
		const distance = textWidth + spacing;
		const duration = (distance / speed) * 1000;
		offset.value = withRepeat(
			withDelay(pause, withTiming(-distance, { duration, easing: Easing.linear })),
			-1,
			false,
			undefined,
			ReduceMotion.Never,
		);

		return () => cancelAnimation(offset);
	}, [overflowing, paused, textWidth, spacing, speed, pause, offset]);

	const rowStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: offset.value }],
	}));

	// The opaque cover hides the left fade at both ends of a pass and reveals it in the middle.
	// At the START (offset 0) it is opaque, so the title's beginning is fully visible. It crossfades
	// out over the first `fadeWidth` px as the text scrolls (left fade appears), then crossfades back
	// in over the LAST `fadeWidth` px — by then the looping second copy's start has scrolled back to
	// the left edge and must be shown unfaded, matching the rest state so the loop reset is seamless.
	const leftCoverStyle = useAnimatedStyle(() => {
		const distance = textWidth + spacing;
		if (distance <= 0) return { opacity: 1 };
		const reveal = Math.min(fadeWidth, distance / 2);
		return {
			opacity: interpolate(
				-offset.value,
				[0, reveal, distance - reveal, distance],
				[1, 0, 0, 1],
				Extrapolation.CLAMP,
			),
		};
	});

	const onContainerLayout = (e: LayoutChangeEvent) => {
		setContainerWidth(e.nativeEvent.layout.width);
	};
	const onMeasureLayout = (e: LayoutChangeEvent) => {
		setTextWidth(e.nativeEvent.layout.width);
		setTextHeight(e.nativeEvent.layout.height);
	};

	// Both-side fade ramps, each `fadeWidth` px expressed as a fraction of the container. The left
	// ramp is kept hidden at rest by the sliding cover below.
	const fade = containerWidth > 0 ? Math.min(fadeWidth / containerWidth, 0.45) : 0;

	return (
		<View
			onLayout={onContainerLayout}
			style={[{ overflow: "hidden" }, containerStyle]}
		>
			{/* Hidden, unconstrained measurer: drives the overflow decision. */}
			<View
				style={MEASURE_WRAP}
				pointerEvents="none"
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			>
				<Text {...textProps} numberOfLines={1} onLayout={onMeasureLayout} style={style}>
					{children}
				</Text>
			</View>

			{overflowing ? (
				<MaskedView
					style={{ width: containerWidth, height: textHeight }}
					maskElement={
						<View style={{ flex: 1 }}>
							<LinearGradient
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 0 }}
								colors={["transparent", "black", "black", "transparent"]}
								locations={[0, fade, 1 - fade, 1]}
								style={StyleSheet.absoluteFill}
							/>
							{/* Opaque cover over the left fade: fully opaque (= title shown) at rest, then
							    crossfades out to reveal the fade as the text scrolls. */}
							<Animated.View
								style={[
									{
										position: "absolute",
										left: 0,
										top: 0,
										bottom: 0,
										width: fadeWidth,
										backgroundColor: "black",
									},
									leftCoverStyle,
								]}
							/>
						</View>
					}
				>
					<Animated.View style={[{ flexDirection: "row" }, rowStyle]}>
						{/* Each copy is pinned to the measured intrinsic width so the row (clamped to
						    the mask's width) cannot truncate it; it overflows the mask, which clips
						    and fades it. The copies start exactly `textWidth + spacing` apart, the
						    same distance the row translates, so the loop reset is seamless. */}
						<Text {...textProps} numberOfLines={1} style={[style, { width: textWidth }]}>
							{children}
						</Text>
						<View style={{ width: spacing }} />
						<Text
							{...textProps}
							numberOfLines={1}
							style={[style, { width: textWidth }]}
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
						>
							{children}
						</Text>
					</Animated.View>
				</MaskedView>
			) : (
				<Text {...textProps} numberOfLines={1} style={style}>
					{children}
				</Text>
			)}
		</View>
	);
}

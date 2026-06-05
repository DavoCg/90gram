import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

type BarConfig = {
	/** Time for one up (or down) sweep, ms. */
	duration: number;
	/** Lowest scaleY of the bounce (0-1). */
	min: number;
	/** Highest scaleY of the bounce (0-1). The min..peak gap is the amplitude. */
	peak: number;
	/** Phase offset so the bars do not move in lockstep, ms. */
	delay: number;
};

type EqualizerBarsProps = {
	/** While true the bars bounce; while false they settle low and hold still. */
	playing: boolean;
	/** Bar color. */
	color: string;
	/** Overall height of the indicator, in pixels. */
	size?: number;
};

// Per-bar tempo, travel and phase, hand-picked (not random, so it is stable across renders) to
// read as a lively, out-of-sync equalizer.
const BARS: readonly BarConfig[] = [
	{ duration: 420, min: 0.5, peak: 0.8, delay: 0 },
	{ duration: 340, min: 0.6, peak: 0.9, delay: 130 },
	{ duration: 480, min: 0.45, peak: 0.78, delay: 60 },
	{ duration: 380, min: 0.55, peak: 0.85, delay: 200 },
	{ duration: 300, min: 0.5, peak: 0.82, delay: 90 },
];

// scaleY the bars rest at when paused: a short, even stub.
const REST = 0.4;

function Bar({
	playing,
	color,
	width,
	height,
	config,
}: {
	playing: boolean;
	color: string;
	width: number;
	height: number;
	config: BarConfig;
}) {
	const scale = useSharedValue(REST);

	useEffect(() => {
		cancelAnimation(scale);

		if (!playing) {
			scale.value = withTiming(REST, { duration: 200 });
			return;
		}

		// Bounce between `min` and full height forever. `reverse: true` makes one withTiming sweep
		// up then back down. ReduceMotion.Never keeps it lively even with the OS setting enabled
		// (otherwise withRepeat plays once and freezes).
		scale.value = config.min;
		scale.value = withDelay(
			config.delay,
			withRepeat(
				withTiming(config.peak, {
					duration: config.duration,
					easing: Easing.inOut(Easing.quad),
				}),
				-1,
				true,
				undefined,
				ReduceMotion.Never,
			),
		);

		return () => cancelAnimation(scale);
	}, [playing, scale, config]);

	// Anchor the scale at the bottom so the bar grows upward like an equalizer column.
	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scaleY: scale.value }],
	}));

	return (
		<Animated.View
			style={[
				{
					width,
					height,
					borderRadius: width / 2,
					backgroundColor: color,
					transformOrigin: "bottom",
				},
				animatedStyle,
			]}
		/>
	);
}

/**
 * A small animated "now playing" equalizer: a row of bars that bounce while `playing` and rest
 * low when paused. This is a decorative play-state indicator (driven by playback intent), NOT a
 * real audio spectrum, which the engine cannot provide (see the audio skill). All motion runs on
 * the UI thread via Reanimated.
 */
export function EqualizerBars({ playing, color, size = 16 }: EqualizerBarsProps) {
	const barWidth = Math.max(2, Math.round(size * 0.16));
	const gap = Math.max(1.5, size * 0.08);

	return (
		<View style={{ height: size, flexDirection: "row", alignItems: "flex-end", gap }}>
			{BARS.map((config, i) => (
				<Bar
					key={i}
					playing={playing}
					color={color}
					width={barWidth}
					height={size}
					config={config}
				/>
			))}
		</View>
	);
}

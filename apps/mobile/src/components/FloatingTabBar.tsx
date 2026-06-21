import type { BottomTabBarProps } from "expo-router/tabs";
import {
	Flame,
	Heart,
	Home,
	type LucideIcon,
	Search,
	User,
} from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import type { ThemeColors } from "../theme/colors";
import {
	TAB_BAR_HEIGHT,
	TAB_BAR_SIDE_MARGIN,
	tabBarBottomOffset,
} from "../theme/tab-bar";
import { LiquidGlassSurface } from "./LiquidGlassSurface";

// Custom, fully owned tab bar so the active indicator can SLIDE between tabs (Instagram style),
// which React Navigation's default bar (and the tabBarBackground/tabBarIcon hooks) cannot do: the
// indicator needs every tab's position to animate between them. Rendered via the Tabs `tabBar`
// prop, so it still lives inside the (tabs) shell and recedes with the card when the full player
// opens. Geometry comes from src/theme/tab-bar.ts, shared with the mini-player.

// Maps each tab route name to its lucide glyph. Keys are the route names declared in _layout.
const ICONS: Record<string, LucideIcon> = {
	"(home)": Home,
	hot: Flame,
	favorites: Heart,
	search: Search,
	profile: User,
};

const ICON_SIZE = 24;
// The sliding highlight pill behind the active icon. INDICATOR_INSET is the single, uniform gap to
// the bar on every side: the pill fills its slot minus this inset left/right, and the bar minus it
// top/bottom. Height and corner radius derive from it (radius = bar radius minus the inset, so the
// corner stays concentric with the bar). Centered on the icon, even padding on all four sides.
const INDICATOR_INSET = 6;
const INDICATOR_HEIGHT = TAB_BAR_HEIGHT - INDICATOR_INSET * 2;
const INDICATOR_RADIUS = TAB_BAR_HEIGHT / 2 - INDICATOR_INSET;
// Snappy but smooth slide, tuned to feel like the Instagram indicator.
const SLIDE_SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;

export function FloatingTabBar({
	state,
	navigation,
	descriptors,
	insets,
	isDark,
	colors,
}: BottomTabBarProps & { isDark: boolean; colors: ThemeColors }) {
	const { width: W } = useWindowDimensions();

	const count = state.routes.length;
	// Each tab gets an equal slice of the bar's inner width. The highlight fills its slice minus the
	// uniform INDICATOR_INSET on each side, which both centers it on the icon and gives it the same
	// side gap it has top and bottom.
	const slot = (W - TAB_BAR_SIDE_MARGIN * 2) / count;
	const indicatorWidth = slot - INDICATOR_INSET * 2;
	const indicatorX = (index: number) => index * slot + INDICATOR_INSET;

	// Drive the indicator's x on the UI thread. Initialized at the active tab so it does not slide
	// in from the left on first mount; later index changes spring to the new slot.
	const tx = useSharedValue(indicatorX(state.index));
	useEffect(() => {
		tx.value = withSpring(indicatorX(state.index), SLIDE_SPRING);
		// Re-target when the active tab changes, or when the slot width changes (orientation).
	}, [state.index, slot, tx]);

	const indicatorStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: tx.value }],
	}));

	return (
		// pointerEvents box-none so taps outside the pill fall through to the screen content behind.
		<View
			pointerEvents="box-none"
			style={{
				position: "absolute",
				left: TAB_BAR_SIDE_MARGIN,
				right: TAB_BAR_SIDE_MARGIN,
				bottom: tabBarBottomOffset(insets.bottom),
				height: TAB_BAR_HEIGHT,
			}}
		>
			<View
				style={{
					flex: 1,
					flexDirection: "row",
					borderRadius: TAB_BAR_HEIGHT / 2,
					borderCurve: "continuous",
					shadowColor: "#000",
					shadowOpacity: 0.12,
					shadowRadius: 16,
					shadowOffset: { width: 0, height: 6 },
					elevation: 8,
				}}
			>
				{/* Liquid Glass (or blur) fill, clipped to the pill. */}
				<LiquidGlassSurface
					radius={TAB_BAR_HEIGHT / 2}
					isDark={isDark}
					borderColor={colors.border}
				/>

				{/* The sliding active indicator, behind the icons. */}
				<Animated.View
					pointerEvents="none"
					style={[
						{
							position: "absolute",
							top: INDICATOR_INSET,
							left: 0,
							width: indicatorWidth,
							height: INDICATOR_HEIGHT,
							borderRadius: INDICATOR_RADIUS,
							borderCurve: "continuous",
							backgroundColor: isDark
								? "rgba(255, 255, 255, 0.16)"
								: "rgba(0, 0, 0, 0.07)",
						},
						indicatorStyle,
					]}
				/>

				{state.routes.map((route, index) => {
					const focused = state.index === index;
					const descriptor = descriptors[route.key];
					const label =
						descriptor?.options.tabBarAccessibilityLabel ??
						descriptor?.options.title ??
						route.name;
					const Icon = ICONS[route.name] ?? Home;
					const color = focused ? colors.accent : colors.muted;

					const onPress = () => {
						// Emitting tabPress also drives the per-screen listeners (e.g. Search re-focuses
						// its field when tapped while already active). See src/search/focus-signal.ts.
						const event = navigation.emit({
							type: "tabPress",
							target: route.key,
							canPreventDefault: true,
						});
						if (!focused && !event.defaultPrevented) {
							navigation.navigate(route.name, route.params);
						}
					};

					const onLongPress = () => {
						navigation.emit({ type: "tabLongPress", target: route.key });
					};

					return (
						<Pressable
							key={route.key}
							onPress={onPress}
							onLongPress={onLongPress}
							accessibilityRole="button"
							accessibilityState={{ selected: focused }}
							accessibilityLabel={label}
							// Active glyph gets a slightly bolder stroke so it reads as selected along with
							// the sliding pill and the accent tint.
							style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
						>
							<Icon
								color={color}
								size={ICON_SIZE}
								strokeWidth={focused ? 2.5 : 2}
							/>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

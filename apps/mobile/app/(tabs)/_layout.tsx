import { useWindowDimensions, View } from "react-native";
import Animated, {
	interpolate,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { Tabs } from "expo-router";
import { Flame, Heart, Home, Radio, Search } from "lucide-react-native";
import { NowPlaying } from "../../src/components/NowPlaying";
import { useThemeColors } from "../../src/theme/colors";

// Bottom tab navigator: Home, Hot, Radio, Favorites, Search. Icons are lucide-react-native
// (SVG), tinted by React Navigation via the `color` prop it passes to tabBarIcon. The tab
// bar and header colors come from useThemeColors (the JS mirror of the global.css tokens),
// since React Navigation chrome cannot read Uniwind className styles.
//
// This layout also OWNS the global mini-player (NowPlaying). Mounting it here, INSIDE the tab
// shell, is what lets a sibling root route (settings) slide cleanly over both the tabs and the
// player: it is route structure, not z-index, that puts settings on top. The shared expand/drag
// values also drive the receding "card" effect on the tab content as the player opens.

// Smaller than the React Navigation default (~24), with extra breathing room above the icons.
const TAB_ICON_SIZE = 20;
const TAB_BAR_TOP_PADDING = 4;

export default function TabsLayout() {
	const colors = useThemeColors();

	// Shared motion values for the Now Playing surface. `expand` is the open/close morph
	// (0 = mini-bar, 1 = full player); `drag` is the rigid pixel offset while the open sheet is
	// dragged down to dismiss.
	const { height: H } = useWindowDimensions();
	const expand = useSharedValue(0);
	const drag = useSharedValue(0);

	// The tab shell scales down and rounds behind the player as it opens, and comes back as the
	// sheet is dragged down. `open` blends the morph with the live drag so it tracks the finger.
	const cardStyle = useAnimatedStyle(() => {
		const open = expand.value * (1 - Math.min(Math.max(drag.value / H, 0), 1));
		return {
			transform: [
				{ scale: interpolate(open, [0, 1], [1, 0.92]) },
				{ translateY: interpolate(open, [0, 1], [0, 12]) },
			],
			// Constant ~38pt corners while presented (tracks open/close only, not the drag),
			// matching the player sheet's top corners.
			borderRadius: interpolate(expand.value, [0, 1], [0, 38]),
			borderCurve: "continuous",
			opacity: interpolate(open, [0, 1], [1, 0.6]),
		};
	});

	return (
		// Black backdrop revealed behind the tab "card" as it recedes when the full player opens
		// (Apple Music style). Previously this came from the root GestureHandlerRootView; now that
		// the card animation lives here, the tab shell provides its own black backing so the gap
		// is not the native-stack screen's light background.
		<View style={{ flex: 1, backgroundColor: "#000" }}>
			<Animated.View style={[{ flex: 1, overflow: "hidden" }, cardStyle]}>
				<Tabs
					screenOptions={{
						// Native headers are disabled app-wide; every screen renders the custom
						// <AppHeader> instead (src/components/AppHeader.tsx).
						headerShown: false,
						tabBarActiveTintColor: colors.accent,
						tabBarInactiveTintColor: colors.muted,
						tabBarStyle: {
							backgroundColor: colors.surface,
							borderTopColor: colors.border,
							paddingTop: TAB_BAR_TOP_PADDING,
						},
						sceneStyle: { backgroundColor: colors.bg },
					}}
				>
					<Tabs.Screen
						name="(home)"
						options={{
							title: "Home",
							tabBarIcon: ({ color }) => (
								<Home color={color} size={TAB_ICON_SIZE} />
							),
						}}
					/>
					<Tabs.Screen
						name="hot"
						options={{
							title: "Hot",
							tabBarIcon: ({ color }) => (
								<Flame color={color} size={TAB_ICON_SIZE} />
							),
						}}
					/>
					<Tabs.Screen
						name="radio"
						options={{
							title: "Radio",
							tabBarIcon: ({ color }) => (
								<Radio color={color} size={TAB_ICON_SIZE} />
							),
						}}
					/>
					<Tabs.Screen
						name="favorites"
						options={{
							title: "Favorites",
							tabBarIcon: ({ color }) => (
								<Heart color={color} size={TAB_ICON_SIZE} />
							),
						}}
					/>
					<Tabs.Screen
						name="search"
						options={{
							title: "Search",
							tabBarIcon: ({ color }) => (
								<Search color={color} size={TAB_ICON_SIZE} />
							),
						}}
					/>
				</Tabs>
			</Animated.View>
			{/* The mini-player floats above the tab content (and below any pushed root screen, like
			    settings, since that screen sits above this whole layout in the navigator). */}
			<NowPlaying expand={expand} drag={drag} />
		</View>
	);
}

import { Tabs } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import Animated, {
	interpolate,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { useUniwind } from "uniwind";
import { FloatingTabBar } from "../../src/components/FloatingTabBar";
import { NowPlaying } from "../../src/components/NowPlaying";
import { requestSearchFocus } from "../../src/search/focus-signal";
import { useThemeColors } from "../../src/theme/colors";

// Bottom tab navigator: Home, Hot, Favorites, Search, You. The bar itself is a custom component
// (FloatingTabBar) passed via the Tabs `tabBar` prop, NOT React Navigation's default chrome: this
// is what lets the active indicator SLIDE between tabs (Instagram style) and gives full control
// over the floating, icon-only, Liquid Glass pill. Colors come from useThemeColors (the JS mirror
// of the global.css tokens); the custom bar reads them directly.
//
// This layout also OWNS the global mini-player (NowPlaying). Mounting it here, INSIDE the tab
// shell, is what lets a sibling root route (settings) slide cleanly over both the tabs and the
// player: it is route structure, not z-index, that puts settings on top. The shared expand/drag
// values also drive the receding "card" effect on the tab content as the player opens.

export default function TabsLayout() {
	const colors = useThemeColors();
	// Tint for the glass/blur background follows the active Uniwind theme (same source the nav
	// chrome colors use, so it flips synchronously with them).
	const isDark = useUniwind().theme === "dark";

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
			// Constant rounded corners on the receding screen the whole time the player is
			// presented (opening, open, or being dragged), so it always reads as the same card and
			// matches the player sheet's 38pt top corners. Square only when fully closed, where the
			// screen is full-size and rounding would expose the black corners behind the app.
			borderRadius: expand.value > 0 ? 38 : 0,
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
						sceneStyle: { backgroundColor: colors.bg },
					}}
					// The custom floating bar with the sliding active indicator.
					tabBar={(props) => (
						<FloatingTabBar {...props} isDark={isDark} colors={colors} />
					)}
				>
					<Tabs.Screen name="(home)" options={{ title: "Home" }} />
					<Tabs.Screen name="hot" options={{ title: "Hot" }} />
					<Tabs.Screen name="favorites" options={{ title: "Favorites" }} />
					<Tabs.Screen
						name="search"
						options={{ title: "Search" }}
						listeners={({ navigation }) => ({
							// Tapping the Search tab again while it is already the active tab focuses the
							// search field (first tap navigates here, second tap opens the keyboard). The
							// custom bar also signals this on re-press; keeping the listener covers the
							// default tabPress path too. See src/search/focus-signal.ts.
							tabPress: () => {
								if (navigation.isFocused()) {
									requestSearchFocus();
								}
							},
						})}
					/>
					<Tabs.Screen name="profile" options={{ title: "You" }} />
				</Tabs>
			</Animated.View>
			{/* The mini-player floats above the tab content (and below any pushed root screen, like
			    settings, since that screen sits above this whole layout in the navigator). */}
			<NowPlaying expand={expand} drag={drag} />
		</View>
	);
}

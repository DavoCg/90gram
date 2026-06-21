import { Tabs } from "expo-router";
import {
	Flame,
	Heart,
	Home,
	type LucideIcon,
	Search,
	User,
} from "lucide-react-native";
import { useWindowDimensions, View } from "react-native";
import Animated, {
	interpolate,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";
import { LiquidGlassSurface } from "../../src/components/LiquidGlassSurface";
import { NowPlaying } from "../../src/components/NowPlaying";
import { requestSearchFocus } from "../../src/search/focus-signal";
import { useThemeColors } from "../../src/theme/colors";
import {
	TAB_BAR_HEIGHT,
	TAB_BAR_SIDE_MARGIN,
	tabBarBottomOffset,
} from "../../src/theme/tab-bar";

// Bottom tab navigator: Home, Hot, Favorites, Search, You. Icons are lucide-react-native
// (SVG), tinted by React Navigation via the `color` prop it passes to tabBarIcon. The tab
// bar and header colors come from useThemeColors (the JS mirror of the global.css tokens),
// since React Navigation chrome cannot read Uniwind className styles.
//
// The bar is an Instagram-style FLOATING, icon-only capsule: detached from the screen edges,
// lifted above the home indicator, rounded into a pill, and backed by Apple's Liquid Glass
// (LiquidGlassSurface uses GlassView on iOS 26+ and falls back to a blur elsewhere). Labels are
// hidden, so it reads as a compact row of icons. Geometry constants are shared with the
// mini-player via src/theme/tab-bar.ts so the player floats correctly just above the pill.
//
// This layout also OWNS the global mini-player (NowPlaying). Mounting it here, INSIDE the tab
// shell, is what lets a sibling root route (settings) slide cleanly over both the tabs and the
// player: it is route structure, not z-index, that puts settings on top. The shared expand/drag
// values also drive the receding "card" effect on the tab content as the player opens.

// Icons-only bar, so the glyphs can be a touch larger than the old labelled bar's ~20.
const TAB_ICON_SIZE = 24;

// A centered icon slot with an Instagram-style active indicator: a rounded highlight pill sits
// behind the focused tab's icon. The wrapper also fills the bar height so the icon is vertically
// centered (with labels hidden, the default layout otherwise top-aligns the glyph).
function TabBarIcon({
	Icon,
	color,
	focused,
	isDark,
}: {
	Icon: LucideIcon;
	color: string;
	focused: boolean;
	isDark: boolean;
}) {
	return (
		<View
			style={{
				height: TAB_BAR_HEIGHT,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<View
				style={{
					width: 48,
					height: 34,
					borderRadius: 17,
					borderCurve: "continuous",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: focused
						? isDark
							? "rgba(255, 255, 255, 0.16)"
							: "rgba(0, 0, 0, 0.07)"
						: "transparent",
				}}
			>
				<Icon color={color} size={TAB_ICON_SIZE} />
			</View>
		</View>
	);
}

export default function TabsLayout() {
	const colors = useThemeColors();
	// Tint for the glass/blur background follows the active Uniwind theme (same source the nav
	// chrome colors use, so it flips synchronously with them). The surface reads the scrolled-under
	// list content as a frosted backdrop; the lists already pad 140pt at the bottom so nothing is
	// clipped by the now-floating (position: absolute) bar.
	const isDark = useUniwind().theme === "dark";
	// The floating pill rests on the bottom safe-area inset (home indicator); read it here so the
	// bar lifts off the screen edge on devices that have one.
	const insets = useSafeAreaInsets();

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
						tabBarActiveTintColor: colors.accent,
						tabBarInactiveTintColor: colors.muted,
						// Icon-only, Instagram style: drop the text labels entirely.
						tabBarShowLabel: false,
						// Liquid Glass (or blur) fill, clipped to the pill's radius. It sits behind the
						// icons and lets the scrolled-under content show through as a frosted backdrop.
						tabBarBackground: () => (
							<LiquidGlassSurface
								radius={TAB_BAR_HEIGHT / 2}
								isDark={isDark}
								borderColor={colors.border}
							/>
						),
						// Floating capsule: detached from the edges (side margins), lifted above the home
						// indicator (bottom offset), a fixed height, and pill-rounded. Transparent fill +
						// no top border so only the glass background shows; a soft shadow makes it float.
						tabBarStyle: {
							position: "absolute",
							left: TAB_BAR_SIDE_MARGIN,
							right: TAB_BAR_SIDE_MARGIN,
							bottom: tabBarBottomOffset(insets.bottom),
							height: TAB_BAR_HEIGHT,
							borderRadius: TAB_BAR_HEIGHT / 2,
							borderCurve: "continuous",
							borderTopWidth: 0,
							backgroundColor: "transparent",
							// React Navigation adds the bottom safe-area inset as padding by default; the
							// pill is a fixed height that floats above the inset, so zero it out and let the
							// item style center the icons within the height.
							paddingTop: 0,
							paddingBottom: 0,
							shadowColor: "#000",
							shadowOpacity: 0.12,
							shadowRadius: 16,
							shadowOffset: { width: 0, height: 6 },
							elevation: 8,
						},
						// Fill the pill height and center the icon slot within it (the TabBarIcon wrapper
						// handles vertical centering now that there is no label below the glyph).
						tabBarItemStyle: { height: TAB_BAR_HEIGHT, paddingVertical: 0 },
						sceneStyle: { backgroundColor: colors.bg },
					}}
				>
					<Tabs.Screen
						name="(home)"
						options={{
							title: "Home",
							tabBarIcon: ({ color, focused }) => (
								<TabBarIcon
									Icon={Home}
									color={color}
									focused={focused}
									isDark={isDark}
								/>
							),
						}}
					/>
					<Tabs.Screen
						name="hot"
						options={{
							title: "Hot",
							tabBarIcon: ({ color, focused }) => (
								<TabBarIcon
									Icon={Flame}
									color={color}
									focused={focused}
									isDark={isDark}
								/>
							),
						}}
					/>
					<Tabs.Screen
						name="favorites"
						options={{
							title: "Favorites",
							tabBarIcon: ({ color, focused }) => (
								<TabBarIcon
									Icon={Heart}
									color={color}
									focused={focused}
									isDark={isDark}
								/>
							),
						}}
					/>
					<Tabs.Screen
						name="search"
						options={{
							title: "Search",
							tabBarIcon: ({ color, focused }) => (
								<TabBarIcon
									Icon={Search}
									color={color}
									focused={focused}
									isDark={isDark}
								/>
							),
						}}
						listeners={({ navigation }) => ({
							// Tapping the Search tab again while it is already the active tab focuses the
							// search field (first tap navigates here, second tap opens the keyboard). The
							// screen does the focusing; we just signal it. See src/search/focus-signal.ts.
							tabPress: () => {
								if (navigation.isFocused()) {
									requestSearchFocus();
								}
							},
						})}
					/>
					<Tabs.Screen
						name="profile"
						options={{
							title: "You",
							tabBarIcon: ({ color, focused }) => (
								<TabBarIcon
									Icon={User}
									color={color}
									focused={focused}
									isDark={isDark}
								/>
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

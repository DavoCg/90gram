import { Heart, Home, Newspaper, Radio, Search } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { useThemeColors } from '../../src/theme/colors';

// Bottom tab navigator: Home, News, Radio, Favorites, Search. Icons are lucide-react-native
// (SVG), tinted by React Navigation via the `color` prop it passes to tabBarIcon. The tab
// bar and header colors come from useThemeColors (the JS mirror of the global.css tokens),
// since React Navigation chrome cannot read Uniwind className styles.

// Smaller than the React Navigation default (~24), with extra breathing room above the icons.
const TAB_ICON_SIZE = 20;
const TAB_BAR_TOP_PADDING = 4;

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        // Native headers are disabled app-wide; every screen renders the custom <AppHeader>
        // instead (src/components/AppHeader.tsx).
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
          title: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ color }) => <Newspaper color={color} size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="radio"
        options={{
          title: 'Radio',
          tabBarIcon: ({ color }) => <Radio color={color} size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color }) => <Heart color={color} size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Search color={color} size={TAB_ICON_SIZE} />,
        }}
      />
    </Tabs>
  );
}

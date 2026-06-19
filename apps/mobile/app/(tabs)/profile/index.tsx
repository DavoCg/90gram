import { ActivityIndicator, View } from '../../../src/theme/uniwind';
import { AppHeader } from '../../../src/components/AppHeader';
import { useMyProfile } from '../../../src/api/hooks';
import ProfileScreen from '../../../src/screens/profile';

// The "You" tab: the signed-in user's own profile. Resolve the username first (the gate guarantees
// one exists past onboarding), then render the shared ProfileScreen, which detects isMe and shows the
// owner affordances (edit, settings, new collection).
export default function MyProfileScreen() {
  const { data: profile } = useMyProfile();

  if (!profile?.username) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Profile" showBack={false} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  // The "You" tab is the root of its stack, so never show a back arrow here (only pushed profiles do).
  return <ProfileScreen username={profile.username} showBack={false} />;
}

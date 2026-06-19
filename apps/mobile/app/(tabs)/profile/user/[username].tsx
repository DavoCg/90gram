import { useLocalSearchParams } from 'expo-router';
import ProfileScreen from '../../../../src/screens/profile';

// Another user's public profile, pushed on top of the Profile stack. Renders the same ProfileScreen
// as the "You" tab; it shows a follow button (not edit) because isMe is false for other users.
export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <ProfileScreen username={username ?? ''} />;
}

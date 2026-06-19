import { useLocalSearchParams } from 'expo-router';
import UserListScreen from '../../../src/screens/user-list';

// The followers list for a user (the `username` query param), pushed on the Profile stack.
export default function FollowersScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <UserListScreen username={username ?? ''} mode="followers" />;
}

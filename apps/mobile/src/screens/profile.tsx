import { useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import type { CollectionDto } from '@getvinyls/api-client';
import { ActivityIndicator, Pressable, ScrollView, View } from '../theme/uniwind';
import { Text } from '../components/text';
import { PressableScale } from '../components/pressable-scale';
import { Avatar } from '../components/avatar';
import { Button } from '../components/button';
import { FollowButton } from '../components/follow-button';
import { CollectionCard } from '../components/collection-card';
import { AppHeader } from '../components/AppHeader';
import { IconButton } from '../components/button';
import { useThemeColors } from '../theme/colors';
import { useScreenRefresh } from '../hooks/use-screen-refresh';
import { useUser, useUserCollections, useMyCollections } from '../api/hooks';

const LIST_BOTTOM_PADDING = 160;

// A tappable stat block (Followers / Following / Records).
function Stat({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} disabled={!onPress} className="flex-1 items-center">
      <Text size="lg" weight="bold">
        {value}
      </Text>
      <Text size="sm" color="neutral-soft">
        {label}
      </Text>
    </PressableScale>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-2 pt-5">
      <Text size="lg" weight="bold">
        {title}
      </Text>
      {action}
    </View>
  );
}

// The shared profile view, used for both the signed-in user's own profile (isMe) and any other
// user's public profile. It renders the identity header, the social stats, and a collections rail.
// Owner-only affordances (edit, settings, new collection) show only when isMe; other users get a
// follow button. Lives in src/screens so both profile routes share one implementation. `showBack`
// controls the header arrow: the "You" tab is a stack root and passes false; pushed profiles leave
// it undefined so AppHeader auto-detects (canGoBack) and shows the arrow.
export default function ProfileScreen({
  username,
  showBack,
}: {
  username: string;
  showBack?: boolean;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const { data: profile, isLoading, isError, refetch } = useUser(username);
  // The own-profile rail reads the SAME cache as the add-to-collection sheet (useMyCollections,
  // keyed ['collections','mine']), so the two share collections and neither flashes a spinner; other
  // users' collections are public and keyed per username. Exactly one of these fetches (the other is
  // disabled) so the own profile never double-loads its collections. isMe is known instantly on the
  // "You" tab via useUser's placeholder, so the right hook is enabled from the first render.
  const isMe = profile?.isMe ?? false;
  const mine = useMyCollections(isMe);
  const theirs = useUserCollections(username, !isMe);
  const collections = isMe ? mine.data : theirs.data;
  const refetchCollections = isMe ? mine.refetch : theirs.refetch;

  const { refreshing, handleRefresh } = useScreenRefresh(() =>
    Promise.all([refetch(), refetchCollections()]),
  );

  const onOpenCollection = useCallback(
    (id: string) => router.push(`/profile/collection/${id}`),
    [router],
  );

  if (isLoading || !profile) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader showBack={showBack} />
        <View className="flex-1 items-center justify-center gap-3 px-6">
          {isError ? (
            <>
              <Text align="center">Could not load this profile.</Text>
              <PressableScale
                onPress={() => void refetch()}
                className="rounded-full curve-continuous bg-accent px-5 py-2"
              >
                <Text color="white">Retry</Text>
              </PressableScale>
            </>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      </View>
    );
  }

  const handle = profile.username ?? username;
  const myCollections = collections ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title={`@${handle}`}
        showBack={showBack}
        right={
          profile.isMe ? (
            <IconButton
              onPress={() => router.push('/settings')}
              accessibilityLabel="Settings"
              icon={<Settings color={colors.text} size={20} />}
            />
          ) : undefined
        }
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Identity. */}
        <View className="items-center px-6 pt-2">
          <Avatar uri={profile.avatarUrl} name={profile.displayName ?? handle} size={96} />
          {profile.displayName ? (
            <Text size="2xl" weight="bold" align="center" className="mt-3">
              {profile.displayName}
            </Text>
          ) : null}
          <Text size="md" color="neutral-soft" align="center" className="mt-0.5">
            @{handle}
          </Text>
          {profile.bio ? (
            <Text color="neutral-soft" align="center" multiline className="mt-2">
              {profile.bio}
            </Text>
          ) : null}
        </View>

        {/* Stats. */}
        <View className="mt-5 flex-row px-6">
          <Stat
            value={profile.followerCount}
            label="Followers"
            onPress={() => router.push(`/profile/followers?username=${handle}`)}
          />
          <Stat
            value={profile.followingCount}
            label="Following"
            onPress={() => router.push(`/profile/following?username=${handle}`)}
          />
          <Stat value={profile.favoriteCount} label="Records" />
        </View>

        {/* Primary action: edit (self) or follow (others). */}
        <View className="mt-5 px-6">
          {profile.isMe ? (
            <Button
              label="Edit profile"
              layout="flex"
              variant="soft"
              color="neutral"
              onPress={() => router.push('/edit-profile')}
            />
          ) : profile.username ? (
            <View className="items-start">
              <FollowButton username={profile.username} isFollowing={profile.isFollowing} size="sm" />
            </View>
          ) : null}
        </View>

        {/* Collections rail. */}
        <SectionHeader
          title="Collections"
          action={
            profile.isMe ? (
              <Pressable onPress={() => router.push('/new-collection')} hitSlop={8}>
                <Text color="accent" weight="semibold">
                  New
                </Text>
              </Pressable>
            ) : undefined
          }
        />
        {myCollections.length === 0 ? (
          <Text color="neutral-soft" className="px-4">
            {profile.isMe ? 'Create a group to save records into.' : 'No collections yet.'}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
          >
            {myCollections.map((collection: CollectionDto) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onPress={onOpenCollection}
              />
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
}

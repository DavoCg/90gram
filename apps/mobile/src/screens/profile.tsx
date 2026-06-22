import { useCallback } from 'react';
import { RefreshControl, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
// Collections grid: two columns inset from the screen edges with a gap between them.
const GRID_PADDING = 16;
const GRID_GAP = 14;

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
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation('common');
  const { width } = useWindowDimensions();
  // Two columns: split the row width (minus side insets and the inter-column gap) in half.
  const cardSize = (width - GRID_PADDING * 2 - GRID_GAP) / 2;
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
              <Text align="center">{t('loadError')}</Text>
              <PressableScale
                onPress={() => void refetch()}
                className="rounded-full curve-continuous bg-accent px-5 py-2"
              >
                <Text color="white">{tc('actions.retry')}</Text>
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
              accessibilityLabel={t('settingsA11y')}
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
            label={t('stats.followers', { count: profile.followerCount })}
            onPress={() => router.push(`/profile/followers?username=${handle}`)}
          />
          <Stat
            value={profile.followingCount}
            label={t('stats.following')}
            onPress={() => router.push(`/profile/following?username=${handle}`)}
          />
          <Stat
            value={profile.favoriteCount}
            label={t('stats.records', { count: profile.favoriteCount })}
          />
        </View>

        {/* Primary action: edit (self) or follow (others). */}
        <View className="mt-5 px-6">
          {profile.isMe ? (
            <Button
              label={t('actions.editProfile')}
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
          title={t('collections.title')}
          action={
            profile.isMe ? (
              <Pressable onPress={() => router.push('/new-collection')} hitSlop={8}>
                <Text color="accent" weight="semibold">
                  {t('collections.new')}
                </Text>
              </Pressable>
            ) : undefined
          }
        />
        {myCollections.length === 0 ? (
          <Text color="neutral-soft" className="px-4">
            {profile.isMe ? t('collections.emptyOwn') : t('collections.emptyOther')}
          </Text>
        ) : (
          <View
            className="flex-row flex-wrap"
            style={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
          >
            {myCollections.map((collection: CollectionDto) => (
              // Each card animates as the list changes: fade in when a collection is created, fade
              // out when deleted, and spring to its new grid slot as siblings reflow. layout is on
              // the wrapper (not the card) so the press-scale bounce inside stays independent.
              <Animated.View
                key={collection.id}
                entering={FadeIn.duration(220)}
                exiting={FadeOut.duration(160)}
                layout={LinearTransition.springify().damping(15).stiffness(280).mass(0.5)}
                style={{ width: cardSize }}
              >
                <CollectionCard
                  collection={collection}
                  onPress={onOpenCollection}
                  size={cardSize}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

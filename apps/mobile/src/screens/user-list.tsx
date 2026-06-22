import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LegendList, type LegendListRenderItemProps } from '@legendapp/list/react-native';
import type { UserSummaryDto } from '@getvinyls/api-client';
import { ActivityIndicator, View } from '../theme/uniwind';
import { Text } from '../components/text';
import { AppHeader } from '../components/AppHeader';
import { UserRow, USER_ROW_ESTIMATED_HEIGHT } from '../components/user-row';
import { ListFooterLoader } from '../components/list-footer-loader';
import { useFollowers, useFollowing } from '../api/hooks';

const LIST_BOTTOM_PADDING = 140;

// The followers / following list for a user. `mode` picks which relation to page. Shared by both
// routes (followers.tsx, following.tsx) so the list, paging, and row behaviour are identical.
export default function UserListScreen({
  username,
  mode,
}: {
  username: string;
  mode: 'followers' | 'following';
}) {
  const router = useRouter();
  const { t } = useTranslation('profile');
  // Both hooks are always called (rules of hooks); only the active one is enabled by passing a
  // non-empty username, the other is parked with an empty key so it never fetches.
  const followers = useFollowers(mode === 'followers' ? username : '');
  const following = useFollowing(mode === 'following' ? username : '');
  const query = mode === 'followers' ? followers : following;
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const onPressUser = useCallback(
    (handle: string) => router.push(`/profile/user/${handle}`),
    [router],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<UserSummaryDto>) => (
      <UserRow user={item} onPress={onPressUser} />
    ),
    [onPressUser],
  );

  const title = mode === 'followers' ? t('userList.followersTitle') : t('userList.followingTitle');
  const users = data ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={title} />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : users.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text color="neutral-soft">
            {mode === 'followers' ? t('userList.emptyFollowers') : t('userList.emptyFollowing')}
          </Text>
        </View>
      ) : (
        <LegendList
          data={users}
          keyExtractor={(item) => item.username ?? ''}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          recycleItems
          estimatedItemSize={USER_ROW_ESTIMATED_HEIGHT}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<ListFooterLoader loading={isFetchingNextPage} />}
          contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
        />
      )}
    </View>
  );
}

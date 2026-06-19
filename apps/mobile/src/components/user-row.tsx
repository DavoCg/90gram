import { memo } from 'react';
import type { UserSummaryDto } from '@getvinyls/api-client';
import { View } from '../theme/uniwind';
import { PressableScale } from './pressable-scale';
import { Text } from './text';
import { Avatar } from './avatar';
import { FollowButton } from './follow-button';

export interface UserRowProps {
  user: UserSummaryDto;
  onPress: (username: string) => void;
}

// A user list row (followers / following): avatar, display name + @handle, and a trailing follow
// button (hidden for the viewer's own row). Tapping the row opens that user's profile.
function UserRowBase({ user, onPress }: UserRowProps) {
  const handle = user.username ?? 'unknown';
  return (
    <PressableScale
      onPress={() => user.username && onPress(user.username)}
      className="flex-row items-center gap-3 px-4 py-2.5 bg-bg"
    >
      <Avatar uri={user.avatarUrl} name={user.displayName ?? user.username} size={44} />
      <View className="flex-1">
        <Text numberOfLines={1} weight="semibold">
          {user.displayName ?? handle}
        </Text>
        <Text numberOfLines={1} size="sm" color="neutral-soft">
          @{handle}
        </Text>
      </View>
      {!user.isMe && user.username ? (
        <FollowButton username={user.username} isFollowing={user.isFollowing} size="2xs" />
      ) : null}
    </PressableScale>
  );
}

export const UserRow = memo(UserRowBase);

export const USER_ROW_ESTIMATED_HEIGHT = 64;

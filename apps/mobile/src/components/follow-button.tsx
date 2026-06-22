import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { useFollowUser } from '../api/hooks';

interface FollowButtonProps {
  username: string;
  isFollowing: boolean;
  size?: '2xs' | 'xs' | 'sm';
}

// Follow / unfollow toggle. Optimistic via useFollowUser (the user-detail cache flips immediately),
// so the label swaps the instant it is tapped. Filled accent when not yet following, subtle when
// already following (the "tap to unfollow" affordance).
export function FollowButton({ username, isFollowing, size = 'xs' }: FollowButtonProps) {
  const { t } = useTranslation('profile');
  const { mutate, isPending } = useFollowUser();

  const onPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mutate({ username, follow: !isFollowing });
  }, [mutate, username, isFollowing]);

  return (
    <Button
      label={isFollowing ? t('follow.following') : t('follow.follow')}
      onPress={onPress}
      size={size}
      variant={isFollowing ? 'soft' : 'intense'}
      color={isFollowing ? 'neutral' : 'accent'}
      disabled={isPending}
      preserveDisabledStyle
    />
  );
}

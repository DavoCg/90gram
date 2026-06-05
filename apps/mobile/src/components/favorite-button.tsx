import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Heart } from 'lucide-react-native';
import type { VinylSummaryDto, FavoriteTrackDto } from '@getvinyls/api-client';
import { Pressable } from '../theme/uniwind';
import { useIsFavorite, useToggleFavorite } from '../api/hooks';
import { useThemeColors } from '../theme/colors';

// Discriminated props: a button favorites either a vinyl or a track. The full DTO is passed so the
// toggle can optimistically insert it into the favorites list (see useToggleFavorite).
type FavoriteButtonProps = (
  | { targetType: 'vinyl'; vinyl: VinylSummaryDto }
  | { targetType: 'track'; track: FavoriteTrackDto }
) & {
  size?: number;
};

// A heart toggle wired to the per-user favorites. Filled + accent when favorited, outline otherwise.
// Optimistic: the heart flips the instant it is tapped (the cache rewrite drives useIsFavorite).
export function FavoriteButton(props: FavoriteButtonProps) {
  const { size = 22 } = props;
  const colors = useThemeColors();
  const { toggle } = useToggleFavorite();

  const targetId = props.targetType === 'vinyl' ? props.vinyl.id : props.track.id;
  const isFavorite = useIsFavorite(props.targetType, targetId);

  const onPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // The hook computes add/remove from the cache, so fast taps resolve against the latest state.
    if (props.targetType === 'vinyl') {
      toggle({ targetType: 'vinyl', vinyl: props.vinyl });
    } else {
      toggle({ targetType: 'track', track: props.track });
    }
  }, [props, toggle]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      className="h-9 w-9 items-center justify-center"
    >
      <Heart
        color={isFavorite ? colors.accent : colors.text}
        fill={isFavorite ? colors.accent : 'transparent'}
        size={size}
      />
    </Pressable>
  );
}

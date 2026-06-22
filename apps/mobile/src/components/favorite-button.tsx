import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Bookmark } from 'lucide-react-native';
import type { VinylSummaryDto, FavoriteTrackDto } from '@getvinyls/api-client';
import { IconButton } from './button';
import { useIsFavorite, useToggleFavorite } from '../api/hooks';
import { useThemeColors } from '../theme/colors';

// Discriminated props: a button favorites either a vinyl or a track. The full DTO is passed so the
// toggle can optimistically insert it into the favorites list (see useToggleFavorite).
type FavoriteButtonProps =
  | { targetType: 'vinyl'; vinyl: VinylSummaryDto }
  | { targetType: 'track'; track: FavoriteTrackDto };

// Every favorite bookmark renders at this one glyph size so the control looks identical wherever it
// appears (header, track rows, ...). Intentionally not a prop: a per-caller size lets the buttons
// drift out of sync.
const ICON_SIZE = 22;

// A bookmark toggle wired to the per-user favorites. Filled + accent when favorited, outline
// otherwise. Optimistic: the icon flips the instant it is tapped (the cache rewrite drives
// useIsFavorite).
export function FavoriteButton(props: FavoriteButtonProps) {
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
    <IconButton
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      icon={
        <Bookmark
          color={isFavorite ? colors.accent : colors.text}
          fill={isFavorite ? colors.accent : 'transparent'}
          size={ICON_SIZE}
        />
      }
    />
  );
}

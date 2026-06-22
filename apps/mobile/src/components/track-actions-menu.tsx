import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { MoreVertical } from 'lucide-react-native';
import { MenuView, type NativeActionEvent } from '@expo/ui/community/menu';
import type { FavoriteTrackDto } from '@getvinyls/api-client';
import { IconButton } from './button';
import { useIsFavorite, useToggleFavorite } from '../api/hooks';
import { useThemeColors } from '../theme/colors';

const ICON_SIZE = 22;
const FAVORITE_ACTION = 'favorite';

// A per-track "more" button: three vertical dots that open a native menu via @expo/ui's MenuView
// (SwiftUI Menu on iOS, Compose DropdownMenu on Android), opened on tap. For now the only action is
// the favorites toggle; add to `actions` as the menu grows. Replaces the per-row favorite button on
// the vinyl detail screen.
export function TrackActionsMenu({ track }: { track: FavoriteTrackDto }) {
  const colors = useThemeColors();
  const { t } = useTranslation('vinyl');
  const { toggle } = useToggleFavorite();
  const isFavorite = useIsFavorite('track', track.id);

  const onPressAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      if (nativeEvent.event !== FAVORITE_ACTION) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggle({ targetType: 'track', track });
    },
    [toggle, track],
  );

  return (
    <MenuView
      onPressAction={onPressAction}
      actions={[
        {
          id: FAVORITE_ACTION,
          title: isFavorite ? t('track.removeFromFavorites') : t('track.addToFavorites'),
          // SF Symbol (iOS); Android shows the label without an icon for this action.
          image: isFavorite ? 'bookmark.fill' : 'bookmark',
        },
      ]}
    >
      <IconButton
        variant="ghost"
        accessibilityLabel={t('track.actions')}
        icon={<MoreVertical color={colors.muted} size={ICON_SIZE} />}
      />
    </MenuView>
  );
}

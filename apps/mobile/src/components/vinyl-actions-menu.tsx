import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { MoreVertical } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { MenuView, type NativeActionEvent } from '@expo/ui/community/menu';
import type { VinylSummaryDto } from '@getvinyls/api-client';
import { IconButton } from './button';
import { useIsFavorite, useToggleFavorite } from '../api/hooks';
import { useThemeColors } from '../theme/colors';

const ICON_SIZE = 22;
const FAVORITE_ACTION = 'favorite';
const COLLECTION_ACTION = 'collection';

// The vinyl-level "more" button in the detail header: three vertical dots opening a native menu
// (@expo/ui MenuView) with the whole-record actions. Favorites toggles in place; Add to Collection
// opens the picker sheet. Replaces the separate favorite + add-to-collection header icons.
export function VinylActionsMenu({ vinyl }: { vinyl: VinylSummaryDto }) {
  const colors = useThemeColors();
  const { t } = useTranslation('vinyl');
  const router = useRouter();
  const { toggle } = useToggleFavorite();
  const isFavorite = useIsFavorite('vinyl', vinyl.id);

  const onPressAction = useCallback(
    ({ nativeEvent }: NativeActionEvent) => {
      if (nativeEvent.event === FAVORITE_ACTION) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggle({ targetType: 'vinyl', vinyl });
      } else if (nativeEvent.event === COLLECTION_ACTION) {
        router.push(`/add-to-collection?vinylId=${vinyl.id}`);
      }
    },
    [toggle, vinyl, router],
  );

  return (
    <MenuView
      onPressAction={onPressAction}
      actions={[
        {
          id: FAVORITE_ACTION,
          title: isFavorite ? t('vinylActions.removeFromFavorites') : t('vinylActions.addToFavorites'),
          // SF Symbol (iOS); Android shows the label without an icon for this action.
          image: isFavorite ? 'bookmark.fill' : 'bookmark',
        },
        {
          id: COLLECTION_ACTION,
          title: t('vinylActions.addToCollection'),
          image: 'text.badge.plus',
        },
      ]}
    >
      <IconButton
        variant="ghost"
        accessibilityLabel={t('vinylActions.actions')}
        icon={<MoreVertical color={colors.muted} size={ICON_SIZE} />}
      />
    </MenuView>
  );
}

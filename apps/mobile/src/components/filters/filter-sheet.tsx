import { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView as RNScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { ModalBottomSheet } from '@swmansion/react-native-bottom-sheet';
import { Check } from 'lucide-react-native';
import type { GenreDto } from '@getvinyls/api-client';
import { Pressable, View } from '../../theme/uniwind';
import { useThemeColors } from '../../theme/colors';
import { Button } from '../button/button';
import { Text } from '../text';

export interface FilterSheetProps {
  // Open/closed state, driven by the caller. Mapped onto the native sheet's detent index.
  open: boolean;
  // Fired when the sheet should close: a drag-dismiss, or after Clear / Show results.
  onClose: () => void;
  // The validated genres to choose from (from useGenres). Order is the display order.
  genres: GenreDto[];
  // Whether the genres are still loading (shows a spinner in place of the list).
  loading: boolean;
  // The currently applied genre slugs. Seeds the form each time the sheet opens.
  selected: string[];
  // Called with the chosen slugs when the user taps "Show results". The sheet closes afterwards.
  onApply: (genreSlugs: string[]) => void;
}

// The home filter sheet. Currently a single "Genres" section (multi-select, OR semantics), but
// structured to grow more sections later. It is a TanStack Form (the repo convention for every
// form): the `genres` field holds the draft selection, and submitting it ("Show results") applies
// the draft to the feed. Toggling does not refilter until submit; a drag-dismiss discards the draft.
// Built on the shared ModalBottomSheet (see picker-sheet.tsx for the single-select sibling).
export function FilterSheet({
  open,
  onClose,
  genres,
  loading,
  selected,
  onApply,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const form = useForm({
    defaultValues: { genres: selected },
    onSubmit: ({ value }) => {
      onApply(value.genres);
      onClose();
    },
  });

  // Reseed the draft from the applied selection whenever the sheet opens, so reopening after a
  // drag-dismiss starts from what is actually applied rather than a stale draft.
  useEffect(() => {
    if (open) form.reset({ genres: selected });
  }, [open, selected, form]);

  return (
    <ModalBottomSheet
      index={open ? 1 : 0}
      // Only fires on a user-driven snap; index 0 means the user dragged the sheet closed.
      onIndexChange={(i) => {
        if (i === 0) onClose();
      }}
      detents={[0, 'content']}
      scrimColor="rgba(0, 0, 0, 0.5)"
      surface={
        <RNView
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderCurve: 'continuous',
            },
          ]}
        />
      }
    >
      <View className="px-4 pt-2.5" style={{ paddingBottom: insets.bottom + 12 }}>
        {/* Grab handle */}
        <RNView
          style={{
            alignSelf: 'center',
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            marginBottom: 8,
          }}
        />
        <Text size="xl" weight="bold" className="mb-1 px-1">
          Filters
        </Text>
        <Text size="sm" weight="semibold" color="neutral-soft" className="mb-1 mt-2 px-1">
          Genres
        </Text>

        <form.Field name="genres">
          {(field) => {
            const value = field.state.value;
            const count = value.length;
            const toggle = (slug: string) => {
              field.handleChange(
                value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug],
              );
            };
            return (
              <>
                {loading ? (
                  <View className="items-center py-10">
                    <ActivityIndicator />
                  </View>
                ) : genres.length === 0 ? (
                  <View className="py-10">
                    <Text color="neutral-soft" align="center">
                      No genres available yet.
                    </Text>
                  </View>
                ) : (
                  // Cap the list height so a long list scrolls instead of growing past the screen.
                  <RNScrollView
                    style={{ maxHeight: 380 }}
                    contentContainerStyle={{ paddingVertical: 4, gap: 4 }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                  >
                    {genres.map((genre) => {
                      const isSelected = value.includes(genre.slug);
                      return (
                        <Pressable
                          key={genre.slug}
                          onPress={() => toggle(genre.slug)}
                          className={`flex-row items-center gap-3 rounded-2xl curve-continuous px-3 py-2.5 ${
                            isSelected ? 'border-hairline border-border bg-surface-2' : ''
                          }`}
                        >
                          <Text weight="semibold" className="flex-1">
                            {genre.name}
                          </Text>
                          {isSelected ? <Check color={colors.accent} size={20} /> : null}
                        </Pressable>
                      );
                    })}
                  </RNScrollView>
                )}

                {/* Footer actions: clear the draft, or submit it (apply + close). */}
                <View className="mt-3 flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      label="Clear all"
                      variant="soft"
                      color="neutral"
                      disabled={count === 0}
                      onPress={() => field.handleChange([])}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      label={count > 0 ? `Show results (${String(count)})` : 'Show results'}
                      variant="solid"
                      color="accent"
                      onPress={() => void form.handleSubmit()}
                    />
                  </View>
                </View>
              </>
            );
          }}
        </form.Field>
      </View>
    </ModalBottomSheet>
  );
}

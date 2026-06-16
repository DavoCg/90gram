import { useEffect } from 'react';
import { ActivityIndicator, ScrollView as RNScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { Check } from 'lucide-react-native';
import type { GenreDto } from '@getvinyls/api-client';
import { Pressable, View } from '../../theme/uniwind';
import { useThemeColors } from '../../theme/colors';
import { BottomSheet } from '../bottom-sheet';
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
// Built on the shared BottomSheet (see picker-sheet.tsx for the single-select sibling).
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
    // Scrollable sheet (TrueSheet best practice): the genre list is the native-scrolled body, while
    // the title and the action buttons are pinned in the native header/footer (the footer also lifts
    // above the keyboard for free). The TanStack form is the single source of truth, so the body
    // (a form.Field) and the footer (a form.Subscribe) each read the draft independently from `form`.
    <BottomSheet
      open={open}
      onClose={onClose}
      detents={[0.7, 1]}
      scrollable
      header={
        <View className="px-5 pt-1">
          <Text size="xl" weight="bold">
            Filters
          </Text>
          <Text size="sm" weight="semibold" color="neutral-soft" className="mt-2">
            Genres
          </Text>
        </View>
      }
      footer={
        // Read just the draft count so the buttons re-render on toggle without re-rendering the list.
        <form.Subscribe selector={(state) => state.values.genres.length}>
          {(count) => (
            <View className="flex-row gap-3 px-4 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
              <View className="flex-1">
                <Button
                  label="Clear all"
                  variant="soft"
                  color="neutral"
                  disabled={count === 0}
                  onPress={() => form.setFieldValue('genres', [])}
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
          )}
        </form.Subscribe>
      }
    >
      <RNScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, gap: 4 }}
        showsVerticalScrollIndicator={false}
      >
        <form.Field name="genres">
          {(field) => {
            const value = field.state.value;
            const toggle = (slug: string) => {
              field.handleChange(
                value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug],
              );
            };
            if (loading) {
              return (
                <View className="items-center py-10">
                  <ActivityIndicator />
                </View>
              );
            }
            if (genres.length === 0) {
              return (
                <View className="py-10">
                  <Text color="neutral-soft" align="center">
                    No genres available yet.
                  </Text>
                </View>
              );
            }
            return (
              <>
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
              </>
            );
          }}
        </form.Field>
      </RNScrollView>
    </BottomSheet>
  );
}

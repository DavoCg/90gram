import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from '@tanstack/react-form';
import { View } from '../../../src/theme/uniwind';
import { useGenres } from '../../../src/api/hooks';
import { Button } from '../../../src/components/button';
import { Text } from '../../../src/components/text';
import { FormSheetHeader } from '../../../src/components/form-sheet-header';
import {
  SHEET_PADDING_X,
  SheetScrollView,
  SheetSelectableRow,
} from '../../../src/components/sheet';
import { useSheetBottomPadding } from '../../../src/components/use-sheet-bottom-padding';
import { filters$ } from '../../../src/components/filters/filters-store';

// Height of the pinned footer (button row + its top padding), used to pad the bottom of the scroll
// content. A form sheet with three subviews lets the ScrollView fill behind the pinned footer, so the
// last rows need this clearance to scroll above it. Kept static (no onLayout) since the button row
// height is fixed; the safe-area inset is added on top at the call site.
const FOOTER_CLEARANCE = 64;

// The home filter sheet, presented as a native form sheet (see app/(tabs)/(home)/_layout.tsx).
// Currently a single "Genres" section (multi-select, OR semantics), structured to grow. It is a
// TanStack Form (the repo convention): the `genres` field holds the draft, seeded from the applied
// filters$ when the route mounts. Submitting ("Show results") writes the draft to filters$ (which the
// home feed reads) and dismisses; a drag-dismiss simply never writes, so the draft is discarded.
export default function FilterSheet() {
  const router = useRouter();
  const bottomPadding = useSheetBottomPadding();
  const genresQuery = useGenres();
  const genres = genresQuery.data ?? [];

  const form = useForm({
    // Seed from the applied selection. The route mounts fresh each open, so no reseed effect needed.
    defaultValues: { genres: filters$.genres.peek() },
    onSubmit: ({ value }) => {
      filters$.genres.set(value.genres);
      router.back();
    },
  });

  return (
    // Pinned title AND footer means leaving 'fitToContents': a form sheet only pins a single header
    // region, so here the sheet is a definite height (fixed detents) and we lay out a normal flex
    // column instead, with the header and footer marked collapsable={false} (so RN keeps them as real
    // native views, the fix for the list overlapping pinned chrome) and the ScrollView filling the
    // middle. Background is set per subview, not on the root wrapper, which would re-trigger overlap.
    <View style={{ flex: 1 }}>
      <FormSheetHeader title="Filters" subtitle="Genres" />

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
              <SheetScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingBottom: bottomPadding + FOOTER_CLEARANCE,
                  gap: 4,
                }}
              >
                {genresQuery.isLoading ? (
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
                  genres.map((genre) => {
                    const isSelected = value.includes(genre.slug);
                    return (
                      <SheetSelectableRow
                        key={genre.slug}
                        selected={isSelected}
                        onPress={() => toggle(genre.slug)}
                      >
                        <Text weight="semibold">{genre.name}</Text>
                      </SheetSelectableRow>
                    );
                  })
                )}
              </SheetScrollView>

              {/* Pinned footer: clear the draft, or submit it (apply + close). */}
              <View
                collapsable={false}
                className="bg-surface flex-row gap-3 pt-2"
                style={{ paddingBottom: bottomPadding, paddingHorizontal: SHEET_PADDING_X }}
              >
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
  );
}

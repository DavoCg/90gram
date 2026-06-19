import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '../src/components/button';
import { Input } from '../src/components/input';
import { Text } from '../src/components/text';
import { View } from '../src/theme/uniwind';
import { FormSheetHeader } from '../src/components/form-sheet-header';
import { SheetScrollView } from '../src/components/sheet';
import { useSheetBottomPadding } from '../src/components/use-sheet-bottom-padding';
import { useCreateCollection } from '../src/api/hooks';

// Create a saved group (collection), presented as a native form sheet (a ROOT route, like the
// currency picker and the add-to-collection sheet, so it slides up over whatever screen opened it
// rather than living inside the Profile stack). Creates the collection and pops back, where it
// appears in the collections rail. Structured as exactly two subviews (a collapsable={false}
// FormSheetHeader + a SheetScrollView) so react-native-screens can size the sheet to its contents.
export default function NewCollectionSheet() {
  const router = useRouter();
  const bottomPadding = useSheetBottomPadding();
  const createCollection = useCreateCollection();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: '', description: '' },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await createCollection.mutateAsync({
          name: value.name.trim(),
          description: value.description.trim() || null,
        });
        router.back();
      } catch {
        setServerError('Could not create the collection. Try again.');
      }
    },
  });

  return (
    <>
      <FormSheetHeader
        title="New collection"
        subtitle='Group records together, like "Best techno 2026". Your followers can see it.'
      />
      <SheetScrollView contentContainerStyle={{ paddingBottom: bottomPadding }}>
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              value.trim().length > 0 ? undefined : 'Give your collection a name.',
          }}
        >
          {(field) => (
            <Input
              size="lg"
              placeholder="Collection name"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              autoFocus
              maxLength={80}
              returnKeyType="next"
            />
          )}
        </form.Field>

        <View className="mt-4">
          <form.Field name="description">
            {(field) => (
              <Input
                size="lg"
                placeholder="Description (optional)"
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                maxLength={300}
                returnKeyType="done"
                onSubmitEditing={() => void form.handleSubmit()}
              />
            )}
          </form.Field>
        </View>

        {serverError ? (
          <Text size="sm" color="critical" className="mt-3">
            {serverError}
          </Text>
        ) : null}

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <View className="mt-5">
              <Button
                label="Create"
                layout="flex"
                loading={isSubmitting}
                disabled={isSubmitting || !canSubmit}
                onPress={() => void form.handleSubmit()}
              />
            </View>
          )}
        </form.Subscribe>
      </SheetScrollView>
    </>
  );
}

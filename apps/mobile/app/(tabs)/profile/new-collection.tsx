import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '../../../src/components/button';
import { Input } from '../../../src/components/input';
import { Text } from '../../../src/components/text';
import { View } from '../../../src/theme/uniwind';
import { useSheetBottomPadding } from '../../../src/components/use-sheet-bottom-padding';
import { useCreateCollection } from '../../../src/api/hooks';

// Create a saved group (collection), presented as a native form sheet (see the screen options in the
// profile stack layout). Creates the collection and pops back to the profile, where it appears in the
// collections rail.
export default function NewCollectionScreen() {
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
    <View className="bg-surface px-5 pt-8" style={{ paddingBottom: bottomPadding }}>
      <Text size="xl" weight="bold">
        New collection
      </Text>
      <Text size="sm" color="neutral-soft" className="mt-1" multiline>
        Group records together, like "Best techno 2026". Your followers can see it.
      </Text>

      <View className="mt-5">
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
      </View>

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
    </View>
  );
}

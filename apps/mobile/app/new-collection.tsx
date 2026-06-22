import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('vinyl');
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
        setServerError(t('collection.createFailed'));
      }
    },
  });

  return (
    <>
      <FormSheetHeader
        title={t('collection.createTitle')}
        subtitle={t('collection.createSubtitle')}
      />
      <SheetScrollView contentContainerStyle={{ paddingBottom: bottomPadding }}>
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              value.trim().length > 0 ? undefined : t('collection.nameRequired'),
          }}
        >
          {(field) => (
            <Input
              size="lg"
              placeholder={t('collection.namePlaceholder')}
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
                placeholder={t('collection.descriptionPlaceholder')}
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
                label={t('collection.create')}
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

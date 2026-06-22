import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ListPlus, Plus } from 'lucide-react-native';
import { Pressable, View } from '../src/theme/uniwind';
import { Text } from '../src/components/text';
import { Input } from '../src/components/input';
import { Button } from '../src/components/button';
import { FormSheetHeader } from '../src/components/form-sheet-header';
import { SheetScrollView, SheetSelectableRow } from '../src/components/sheet';
import { useSheetBottomPadding } from '../src/components/use-sheet-bottom-padding';
import { useThemeColors } from '../src/theme/colors';
import { toast } from '../src/components/toast';
import {
  useCreateCollection,
  useMyCollections,
  useCollectionMemberships,
  useToggleCollectionVinyl,
} from '../src/api/hooks';

// "Save to collection" sheet, opened from a record's page (a root form sheet, like the currency
// picker). It lists the signed-in user's collections with a check for the ones already holding this
// record; tapping toggles membership (optimistic). A new collection can be created inline and the
// record is added to it immediately.
export default function AddToCollectionSheet() {
  const { vinylId } = useLocalSearchParams<{ vinylId: string }>();
  const id = vinylId ?? '';
  const { t } = useTranslation('vinyl');
  const colors = useThemeColors();
  const router = useRouter();
  const bottomPadding = useSheetBottomPadding();

  const { data: collections } = useMyCollections();
  const { data: memberships } = useCollectionMemberships(id);
  const toggleVinyl = useToggleCollectionVinyl();
  const createCollection = useCreateCollection();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const memberIds = new Set(memberships?.collectionIds ?? []);

  // Adding a record is the reason this sheet exists, so a tap that adds confirms with a toast and
  // dismisses the tray. (The toggle's optimistic cache write and its onSettled refresh both run
  // independently of this component, so closing immediately is safe.) Removing just toggles in
  // place. Toasts float over every screen from the root host, so they outlive the sheet.
  const onAdd = (collectionId: string, collectionName: string) => {
    toggleVinyl.mutate({ collectionId, vinylId: id, add: true });
    toast.success(t('collection.added'), { description: collectionName });
    router.back();
  };

  const onCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    const created = await createCollection.mutateAsync({ name: trimmed, description: null });
    // Drop the record straight into the new group, the reason the user opened this sheet.
    setName('');
    setCreating(false);
    onAdd(created.id, trimmed);
  };

  return (
    <>
      <FormSheetHeader title={t('collection.saveTitle')} />
      <SheetScrollView contentContainerStyle={{ paddingBottom: bottomPadding }}>
        {(collections ?? []).map((collection) => {
          const selected = memberIds.has(collection.id);
          return (
            <SheetSelectableRow
              key={collection.id}
              selected={selected}
              onPress={() =>
                selected
                  ? toggleVinyl.mutate({ collectionId: collection.id, vinylId: id, add: false })
                  : onAdd(collection.id, collection.name)
              }
            >
              <View className="flex-1">
                <Text weight="semibold">{collection.name}</Text>
                <Text size="sm" color="neutral-soft" className="mt-0.5">
                  {t('collection.record', { count: collection.vinylCount })}
                </Text>
              </View>
            </SheetSelectableRow>
          );
        })}

        {creating ? (
          <View className="mt-2 gap-3">
            <Input
              size="lg"
              placeholder={t('collection.namePlaceholder')}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={() => void onCreate()}
              startSlot={<ListPlus color={colors.muted} size={20} />}
            />
            <Button
              label={t('collection.createAndAdd')}
              layout="flex"
              loading={createCollection.isPending}
              disabled={createCollection.isPending || name.trim().length === 0}
              onPress={() => void onCreate()}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => setCreating(true)}
            className="flex-row items-center gap-3 py-3"
          >
            <Plus color={colors.accent} size={22} />
            <Text color="accent" weight="semibold">
              {t('collection.newCollection')}
            </Text>
          </Pressable>
        )}
      </SheetScrollView>
    </>
  );
}

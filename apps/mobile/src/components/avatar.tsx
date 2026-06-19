import { Image, View } from '../theme/uniwind';
import { Text } from './text';

// Derive up-to-two initials from a name or username for the placeholder fill.
function initials(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

interface AvatarProps {
  uri?: string | null;
  // Used for the initials placeholder when there is no image (display name or username).
  name?: string | null;
  // Diameter in pixels.
  size?: number;
}

// A round user avatar: the image when present, otherwise a surface circle with the user's initials.
// Mirrors CoverArt's expo-image setup (recyclingKey + cross-dissolve) so it behaves in recycled rows.
export function Avatar({ uri, name, size = 48 }: AvatarProps) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        recyclingKey={uri}
        contentFit="cover"
        transition={{ duration: 220, effect: 'cross-dissolve' }}
        className="bg-surface-2"
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      className="items-center justify-center bg-surface-2"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text weight="semibold" color="neutral-soft" style={{ fontSize: Math.round(size * 0.38) }}>
        {initials(name)}
      </Text>
    </View>
  );
}

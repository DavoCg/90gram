import { createMMKV } from 'react-native-mmkv';

// Synchronous key-value store (MMKV) for small persisted client preferences (the theme today,
// more settings later). Synchronous reads let us apply the saved value during boot with no
// flash. Server/data state belongs in TanStack Query; this is only for tiny UI settings.
export const storage = createMMKV();

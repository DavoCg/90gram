import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from '../../theme/uniwind';
import { ToastItem } from './toast-item';
import { removeToast, useToasts } from './store';

// App-wide toast host. Drop ONE of these near the root (see app/_layout.tsx). It pins a
// box-none column to the top of the screen (so taps fall through the gaps to the UI below) and
// renders the live stack: newest on top, older toasts beneath, each owning its own translate-in
// and swipe-up-to-dismiss (see ToastItem). Trigger toasts from anywhere with the re-exported
// `toast` (see ./index.ts). Styling comes from our Uniwind tokens and Text component, so it
// flips with the theme in the same pass as the rest of the app.
export function AppToaster() {
  const toasts = useToasts();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0 z-50 gap-2.5 px-4"
      style={{ paddingTop: insets.top + 8 }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} data={toast} onRemove={removeToast} />
      ))}
    </View>
  );
}

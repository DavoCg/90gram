import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { TrueSheet, type SheetDetent } from '@lodev09/react-native-true-sheet';
import { useThemeColors } from '../theme/colors';

export interface BottomSheetProps {
  // Open/closed state, driven by the caller. We bridge it onto TrueSheet's imperative API.
  open: boolean;
  // Fired when the sheet closes: a user drag-down, a backdrop tap, or our own dismiss().
  onClose: () => void;
  // The sheet body. TrueSheet paints the surface, corners, grabber and dim natively, so this is
  // just the content; no surface/scrim/handle boilerplate needed. For a scrollable sheet, pass a
  // single ScrollView/FlatList here and set `scrollable` (see below).
  children: ReactNode;
  // Detents in ascending order (max 3): 'auto' = sized to content, a number = that fraction (0-1) of
  // the available height. Defaults to content-sized. NOTE: 'auto' is incompatible with `scrollable`
  // (auto must measure the full content, scrollable clips it), so scrollable sheets pass fractions.
  detents?: SheetDetent[];
  // Turn on TrueSheet's native scroll handling: the ScrollView/FlatList passed as `children` gets
  // pinned and scrolled natively (gestures coordinated with drag-to-dismiss, keyboard avoidance,
  // no maxHeight hacks). Pair with fractional `detents`, never 'auto'.
  scrollable?: boolean;
  // Fixed chrome rendered in native container views OUTSIDE the scroll area, so it stays put while
  // the body scrolls and the footer lifts above the keyboard. Prefer these to in-content headers.
  header?: ReactElement;
  footer?: ReactElement;
}

// Shared bottom sheet, built on @lodev09/react-native-true-sheet (a native iOS/Android sheet, so
// open/resize/dismiss animations, the grabber and the backdrop dim are all driven by the OS).
//
// TrueSheet is imperative (ref.present() / ref.dismiss()), but every caller in the app drives sheets
// declaratively with `open` / `onClose`. This wrapper bridges the two: it presents/dismisses the
// native sheet to follow `open`, and mirrors a user-driven dismissal back through `onClose` so the
// caller's state and the sheet can never desync. Themed surface + 24px corners match the rest of the
// app. Two shapes: content-sized (default 'auto' detent) for short static content, and scrollable
// (fractional detents + `scrollable` + a ScrollView child) for lists that can outgrow the sheet.
export function BottomSheet({
  open,
  onClose,
  children,
  detents = ['auto'],
  scrollable,
  header,
  footer,
}: BottomSheetProps) {
  const colors = useThemeColors();
  const ref = useRef<TrueSheet>(null);

  useEffect(() => {
    if (open) void ref.current?.present();
    else void ref.current?.dismiss();
  }, [open]);

  return (
    <TrueSheet
      ref={ref}
      detents={detents}
      scrollable={scrollable}
      header={header}
      footer={footer}
      cornerRadius={24}
      backgroundColor={colors.surface}
      grabber
      onDidDismiss={onClose}
    >
      {children}
    </TrueSheet>
  );
}

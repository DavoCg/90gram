import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import {
  Airplay,
  ListMusic,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Star,
} from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { use$ } from '@legendapp/state/react';
import { audioEngine } from '../audio/engine';
import { player$ } from '../audio/store';
import { Pressable, View } from '../theme/uniwind';
import { Button } from './button/button';
import { MarqueeText } from './marquee-text';
import { Text } from './text';
import { useThemeColors } from '../theme/colors';
import { BIG_COVER_MAX, BIG_COVER_RADIUS } from '../theme/sizes';
import { SeekBar } from './SeekBar';
import { VolumeSlider } from './VolumeSlider';

// Layout constants. The collapsed mini-bar floats just above the tab bar. React Navigation's
// useBottomTabBarHeight is only available inside a tab screen, not at the root where this
// overlay is mounted, so we reconstruct the standard tab bar height from the platform default
// plus the bottom safe-area inset.
const TAB_BAR_BASE = Platform.OS === 'ios' ? 49 : 56;
const MINI_HEIGHT = 60;
const MINI_MARGIN = 8;
const MINI_ART = 44;
const PAD = 20;
// iOS form-sheet corner radius. Constant: it does not change with the drag.
const SHEET_RADIUS = 38;

const SPRING = { damping: 22, stiffness: 180, mass: 0.7 } as const;
// Snappier spring for the play/pause cover scale: stiffer and lighter so it pops quickly.
const SCALE_SPRING = { damping: 18, stiffness: 380, mass: 0.5 } as const;

// The single, globally-mounted Now Playing surface. Motion is two shared values created in the
// root layout and passed in:
//   - `expand`: the open/close state, 0 = mini-bar, 1 = full player.
//   - `drag`: a rigid pixel offset applied while the open sheet is dragged down to dismiss.
// The full player is a SHEET (opaque, rounded top) that SLIDES up from the bottom on open, so
// its controls slide in from the bottom. The artwork is a SEPARATE shared element on top that
// MORPHS between the mini thumbnail and the large position. Dragging translates the whole sheet
// down rigidly (revealing the rounded top + the receding page); the morph only plays on release.
// Everything moves on the UI thread (transforms only), mirroring the SeekBar discipline.
export function NowPlaying({
  expand,
  drag,
}: {
  expand: SharedValue<number>;
  drag: SharedValue<number>;
}) {
  const track = use$(player$.track);
  const playWhenReady = use$(player$.playWhenReady);
  const positionSec = use$(player$.positionSec);
  const durationSec = use$(player$.durationSec);
  const canSeek = use$(player$.canSeek);
  const queueIndex = use$(player$.queueIndex);
  const queue = use$(player$.queue);

  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const colors = useThemeColors();

  // Mirrors the open/closed state for pointerEvents and the spring-finished callback; never
  // updates per animation frame.
  const [isExpanded, setIsExpanded] = useState(false);

  // The transport icon (and artwork scale) follow the user's play/pause INTENT, not raw playback
  // state. Intent stays true across a track switch while the new track buffers, so the button
  // does not flash to the play triangle; it only shows play when genuinely paused.
  const isPlaying = playWhenReady;
  const hasNext = queueIndex >= 0 && queueIndex < queue.length - 1;
  const progress = durationSec > 0 ? Math.min(Math.max(positionSec / durationSec, 0), 1) : 0;

  // The expanded cover shrinks when paused and grows back when playing (Apple Music). Drive the
  // target through a shared value so the change springs smoothly instead of snapping. ReduceMotion
  // .Never keeps the spring even with the OS setting on (otherwise it would jump to the end).
  const playScale = useSharedValue(isPlaying ? 1 : 0.86);
  useEffect(() => {
    playScale.value = withSpring(isPlaying ? 1 : 0.86, {
      ...SCALE_SPRING,
      reduceMotion: ReduceMotion.Never,
    });
  }, [isPlaying, playScale]);

  // --- Geometry: large (expanded) artwork rect and the mini (collapsed) thumbnail rect. ---
  const tabBarHeight = TAB_BAR_BASE + insets.bottom;
  const large = Math.min(W - PAD * 2, BIG_COVER_MAX, H * 0.5);
  // Center the cover, and inset the controls to its actual edges so the title still lines up with
  // the artwork even when the cover is capped narrower than the screen.
  const sidePad = (W - large) / 2;
  const artTop = insets.top + 44;
  const largeCenterX = W / 2;
  const largeCenterY = artTop + large / 2;

  const miniBarTop = H - tabBarHeight - MINI_MARGIN - MINI_HEIGHT;
  const miniArtLeft = MINI_MARGIN + 8;
  const miniArtTop = miniBarTop + (MINI_HEIGHT - MINI_ART) / 2;
  const miniCenterX = miniArtLeft + MINI_ART / 2;
  const miniCenterY = miniArtTop + MINI_ART / 2;

  const collapsedScale = MINI_ART / large;
  const collapsedTX = miniCenterX - largeCenterX;
  const collapsedTY = miniCenterY - largeCenterY;
  // Counter-scale the radius so the shrunk artwork still reads as ~10px rounded when collapsed.
  const collapsedRadius = 10 / collapsedScale;

  const openPlayer = () => {
    setIsExpanded(true);
    expand.value = withSpring(1, SPRING);
  };

  const finishClose = (finished?: boolean) => {
    'worklet';
    if (finished) runOnJS(setIsExpanded)(false);
  };

  // Drag the whole open sheet down to dismiss. Can be started from anywhere on the sheet:
  // `activeOffsetY` requires vertical intent and `failOffsetX` yields to the horizontal SeekBar
  // / VolumeSlider drags. During the drag nothing morphs (rigid translate); on release we snap
  // back up or play the close morph.
  const dismiss = Gesture.Pan()
    .enabled(isExpanded)
    .activeOffsetY(12)
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const shouldClose = e.translationY > H * 0.2 || e.velocityY > 900;
      if (shouldClose) {
        expand.value = withSpring(0, SPRING, finishClose);
      }
      drag.value = withSpring(0, SPRING);
    });

  // The sheet slides up from the bottom on open and rides the drag down on dismiss. Its top
  // corner radius is constant (set statically below); only the translate animates.
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(expand.value, [0, 1], [H, 0], Extrapolation.CLAMP) + drag.value },
    ],
  }));

  // Artwork morph (expand) composed with the rigid drag offset on the way out. It settles into
  // the mini slot as expand returns to 0 while the sheet (controls) slides off the bottom.
  const artStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      expand.value,
      [0, 1],
      [collapsedScale, playScale.value],
      Extrapolation.CLAMP,
    );
    return {
      borderRadius: interpolate(
        expand.value,
        [0, 1],
        [collapsedRadius, BIG_COVER_RADIUS],
        Extrapolation.CLAMP,
      ),
      transform: [
        { translateX: interpolate(expand.value, [0, 1], [collapsedTX, 0], Extrapolation.CLAMP) },
        {
          translateY:
            interpolate(expand.value, [0, 1], [collapsedTY, 0], Extrapolation.CLAMP) + drag.value,
        },
        { scale },
      ],
    };
  });

  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0, 0.25], [1, 0], Extrapolation.CLAMP),
  }));

  // All hooks above are unconditional; only now do we bail out when nothing is playing.
  if (!track) return null;

  const artwork = track.artwork ? { uri: track.artwork } : undefined;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Collapsed mini-bar, just above the tab bar. Rendered first so the morphing artwork
          (the last sibling below) sits on top of its left slot when collapsed. */}
      <Animated.View
        pointerEvents={isExpanded ? 'none' : 'auto'}
        style={[
          {
            position: 'absolute',
            top: miniBarTop,
            left: MINI_MARGIN,
            right: MINI_MARGIN,
            height: MINI_HEIGHT,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            paddingRight: 6,
            overflow: 'hidden',
          },
          miniStyle,
        ]}
      >
        {/* Tap the bar (outside the buttons) to expand. The artwork floats over this left slot. */}
        <Pressable onPress={openPlayer} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: MINI_ART + 16 }} />
          <View style={{ flex: 1 }}>
            <MarqueeText weight="semibold">{track.title}</MarqueeText>
            <Text numberOfLines={1} size="xs" color="neutral-soft">
              {track.artist}
            </Text>
          </View>
        </Pressable>
        <Button
          onPress={() => void audioEngine.toggle()}
          variant="ghost"
          size="xs"
          layout="square"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          startSlot={
            isPlaying ? (
              <Pause color={colors.text} size={22} fill={colors.text} />
            ) : (
              <Play color={colors.text} size={22} fill={colors.text} />
            )
          }
        />
        <Button
          onPress={() => audioEngine.next()}
          disabled={!hasNext}
          preserveDisabledStyle
          variant="ghost"
          size="xs"
          layout="square"
          accessibilityLabel="Next track"
          style={{ opacity: hasNext ? 1 : 0.35 }}
          startSlot={<SkipForward color={colors.text} size={22} fill={colors.text} />}
        />
        {/* Thin static progress line at the bottom edge of the bar. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 2,
            width: `${progress * 100}%`,
            backgroundColor: colors.accent,
          }}
        />
      </Animated.View>

      {/* The full-screen player sheet: opaque, rounded top, slides up from the bottom. The whole
          sheet (grabber + controls) is the drag target, so it can be dismissed from anywhere. */}
      <GestureDetector gesture={dismiss}>
        <Animated.View
          pointerEvents={isExpanded ? 'auto' : 'none'}
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.bg,
              overflow: 'hidden',
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              borderCurve: 'continuous',
            },
            sheetStyle,
          ]}
        >
          {/* Grabber handle. */}
          <View style={{ alignItems: 'center', paddingTop: insets.top + 10 }}>
            <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.muted }} />
          </View>

          {/* Controls block, below the artwork. */}
          <View
            style={{
              position: 'absolute',
              left: sidePad,
              right: sidePad,
              top: artTop + large + 28,
              bottom: insets.bottom + 16,
            }}
          >
            {/* Title row: title + explicit badge, artist, decorative favorite + more. */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MarqueeText size="2xl" weight="bold" containerStyle={{ flexShrink: 1 }}>
                    {track.title}
                  </MarqueeText>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      borderCurve: 'continuous',
                      backgroundColor: colors.surface2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text size="2xs" weight="bold" color="neutral-soft">
                      E
                    </Text>
                  </View>
                </View>
                <Text numberOfLines={1} size="lg" color="neutral-soft" className="mt-1">
                  {track.artist}
                </Text>
              </View>
              {/* Decorative for now (no favorites / menu backing yet). */}
              <View className="ml-2">
                <Button
                  variant="soft"
                  color="neutral"
                  size="2xs"
                  layout="square"
                  accessibilityLabel="Favorite"
                  startSlot={<Star color={colors.text} size={18} />}
                />
              </View>
              <View className="ml-2">
                <Button
                  variant="soft"
                  color="neutral"
                  size="2xs"
                  layout="square"
                  accessibilityLabel="More"
                  startSlot={<MoreHorizontal color={colors.text} size={18} />}
                />
              </View>
            </View>

            <SeekBar
              positionSec={positionSec}
              durationSec={durationSec}
              canSeek={canSeek}
              showRemaining
              onSeek={(seconds) => audioEngine.seek(seconds)}
            />

            {/* Flexible slack centers the transport between the progress bar and the volume. */}
            <View style={{ flex: 1 }} />

            {/* Transport row. Gap tuned down from 44 to keep the glyph spacing now that each control
                is a square Button box rather than a bare icon. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 22,
              }}
            >
              <Button
                onPress={() => audioEngine.prev()}
                variant="ghost"
                size="md"
                layout="square"
                accessibilityLabel="Previous track"
                startSlot={<SkipBack color={colors.text} size={32} fill={colors.text} />}
              />
              <Button
                onPress={() => void audioEngine.toggle()}
                variant="ghost"
                size="lg"
                layout="square"
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                startSlot={
                  isPlaying ? (
                    <Pause color={colors.text} size={44} fill={colors.text} />
                  ) : (
                    <Play color={colors.text} size={44} fill={colors.text} />
                  )
                }
              />
              <Button
                onPress={() => audioEngine.next()}
                disabled={!hasNext}
                preserveDisabledStyle
                variant="ghost"
                size="md"
                layout="square"
                accessibilityLabel="Next track"
                style={{ opacity: hasNext ? 1 : 0.35 }}
                startSlot={<SkipForward color={colors.text} size={32} fill={colors.text} />}
              />
            </View>

            {/* Push the volume + bottom icons down to the bottom of the sheet. */}
            <View style={{ flex: 1 }} />

            <VolumeSlider
              initialValue={player$.gain.peek()}
              onChange={(value) => audioEngine.setGain(value)}
            />

            {/* Decorative bottom row (lyrics / AirPlay / queue), no backing logic yet. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 18,
                paddingHorizontal: 24,
              }}
            >
              <MessageSquare color={colors.muted} size={20} />
              <Airplay color={colors.muted} size={20} />
              <ListMusic color={colors.muted} size={20} />
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* The single morphing artwork, shared between both states. Rendered last so it sits on top
          of the sheet and the mini-bar. Non-interactive, so drags over it fall through to the
          sheet's dismiss gesture. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: artTop,
            left: (W - large) / 2,
            width: large,
            height: large,
            backgroundColor: colors.surface2,
            overflow: 'hidden',
            borderCurve: 'continuous',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
          },
          artStyle,
        ]}
      >
        <Image source={artwork} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </Animated.View>
    </View>
  );
}

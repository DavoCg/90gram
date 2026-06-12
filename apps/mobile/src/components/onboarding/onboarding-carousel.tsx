import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from '../../theme/uniwind';
import { Text } from '../text';
import { ONBOARDING_SLIDES, type OnboardingSlide } from './onboarding-slides';

// className only flows through a uniwind-wrapped animated component, not raw Animated.View.
const AnimatedView = Animated.createAnimatedComponent(View);

// Instagram-stories style onboarding carousel. Auto-advancing segmented progress bars, a faint
// gradient + icon background per slide, a Ken Burns zoom on the watermark, and tap zones (left =
// previous, right = next, press-and-hold = pause). It pauses when the app backgrounds and resumes
// on return. The landing screen overlays its buttons on top; this component owns only the slides,
// the brand label, the progress bars, and the tap handling.

const AUTO_PLAY_INTERVAL_MS = 4500;
const SLIDE_FADE_DURATION_MS = 260;
const TEXT_ENTER_DURATION_MS = 340;
const TEXT_EXIT_DURATION_MS = 120;
const SUBTITLE_ENTER_DELAY_MS = 90;
const TEXT_ENTER_TRANSLATE_Y = 22;
const KEN_BURNS_ZOOM = 0.08;
const PROGRESS_BAR_HEIGHT = 2.5;
const PROGRESS_BAR_GAP = 6;
const BRAND_LABEL = 'getvinyls';
// Bottom space the slide text must clear so headlines never collide with the landing buttons.
const BUTTONS_CLEARANCE = 184;
const WATERMARK_SIZE = 360;

const styles = StyleSheet.create({
  fill: { position: 'absolute', inset: 0 },
  leftTapZone: { position: 'absolute', top: 0, bottom: 0, left: 0, right: '50%' },
  rightTapZone: { position: 'absolute', top: 0, bottom: 0, left: '50%', right: 0 },
});

interface SlideTextProps {
  slide: OnboardingSlide;
  index: number;
  activeIndex: SharedValue<number>;
}

// Title + subtitle for one slide, staggered in when the slide becomes active and out when it leaves.
function SlideText({ slide, index, activeIndex }: SlideTextProps) {
  const titleStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    const duration = isActive ? TEXT_ENTER_DURATION_MS : TEXT_EXIT_DURATION_MS;
    const config = { duration, easing: Easing.out(Easing.cubic) };
    return {
      opacity: withTiming(isActive ? 1 : 0, config),
      transform: [{ translateY: withTiming(isActive ? 0 : TEXT_ENTER_TRANSLATE_Y, config) }],
    };
  }, [activeIndex, index]);

  const subtitleStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    const duration = isActive ? TEXT_ENTER_DURATION_MS : TEXT_EXIT_DURATION_MS;
    const config = { duration, easing: Easing.out(Easing.cubic) };
    const delay = isActive ? SUBTITLE_ENTER_DELAY_MS : 0;
    return {
      opacity: withDelay(delay, withTiming(isActive ? 1 : 0, config)),
      transform: [
        { translateY: withDelay(delay, withTiming(isActive ? 0 : TEXT_ENTER_TRANSLATE_Y, config)) },
      ],
    };
  }, [activeIndex, index]);

  return (
    <View className="gap-3">
      <Animated.View style={titleStyle}>
        {/* Tighten the display line height (multiline 5xl defaults to 56px on a 48px font). */}
        <Text size="5xl" weight="bold" color="white" multiline style={{ lineHeight: 50 }}>
          {slide.title}
        </Text>
      </Animated.View>
      <Animated.View style={subtitleStyle}>
        <Text size="lg" weight="medium" color="white" multiline className="opacity-80">
          {slide.subtitle}
        </Text>
      </Animated.View>
    </View>
  );
}

interface SlideLayerProps {
  slide: OnboardingSlide;
  index: number;
  activeIndex: SharedValue<number>;
  isPaused: SharedValue<boolean>;
  topInset: number;
  bottomPadding: number;
}

// A single full-screen slide: gradient + Ken Burns watermark + bottom scrim + text. Only the active
// layer is visible (opacity cross-fade); the watermark slowly zooms while the slide is on screen.
function SlideLayer({
  slide,
  index,
  activeIndex,
  isPaused,
  topInset,
  bottomPadding,
}: SlideLayerProps) {
  const zoom = useSharedValue(0);
  const Icon = slide.Icon;

  const layerStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(activeIndex.value === index ? 1 : 0, { duration: SLIDE_FADE_DURATION_MS }),
    }),
    [activeIndex, index],
  );

  const watermarkStyle = useAnimatedStyle(() => {
    // Alternate zoom-in / zoom-out so adjacent slides do not feel identical.
    const zoomsIn = index % 2 === 0;
    const from = zoomsIn ? 1 : 1 + KEN_BURNS_ZOOM;
    const to = zoomsIn ? 1 + KEN_BURNS_ZOOM : 1;
    return { transform: [{ scale: interpolate(zoom.value, [0, 1], [from, to]) }] };
  }, [zoom, index]);

  // Restart the zoom whenever this slide becomes active; cancel it when it leaves.
  useAnimatedReaction(
    () => activeIndex.value === index,
    (isActive, wasActive) => {
      if (isActive && wasActive !== true) {
        zoom.value = 0;
        if (!isPaused.value) {
          zoom.value = withTiming(1, { duration: AUTO_PLAY_INTERVAL_MS, easing: Easing.linear });
        }
      } else if (!isActive && wasActive === true) {
        cancelAnimation(zoom);
      }
    },
    [activeIndex, index, isPaused, zoom],
  );

  useEffect(() => () => cancelAnimation(zoom), [zoom]);

  return (
    <Animated.View style={[styles.fill, layerStyle]} pointerEvents="none">
      <Animated.View style={[styles.fill, watermarkStyle]}>
        <LinearGradient
          colors={slide.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{ position: 'absolute', right: -WATERMARK_SIZE * 0.28, bottom: bottomPadding - 40 }}
          className="opacity-10"
        >
          <Icon size={WATERMARK_SIZE} color="#ffffff" strokeWidth={1} />
        </View>
      </Animated.View>
      {/* Bottom scrim so the white buttons and headline stay legible over any gradient. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
      />
      <View
        className="absolute inset-0 justify-end px-6"
        style={{ paddingTop: topInset, paddingBottom: bottomPadding }}
      >
        <SlideText slide={slide} index={index} activeIndex={activeIndex} />
      </View>
    </Animated.View>
  );
}

interface ProgressBarProps {
  index: number;
  activeIndex: number;
  progress: SharedValue<number>;
}

// One segment of the stories progress row: full if already seen, live-filling if active, empty if
// upcoming. The active segment scaleXs from its `progress` shared value on the UI thread.
function ProgressBar({ index, activeIndex, progress }: ProgressBarProps) {
  const fillStyle = useAnimatedStyle(() => {
    const fill = index < activeIndex ? 1 : index === activeIndex ? progress.value : 0;
    return { transform: [{ scaleX: fill }] };
  }, [progress, activeIndex, index]);

  return (
    <View
      className="flex-1 overflow-hidden rounded-full bg-white/25"
      style={{ height: PROGRESS_BAR_HEIGHT }}
    >
      <AnimatedView
        className="h-full w-full rounded-full bg-white"
        style={[{ alignSelf: 'flex-start', transformOrigin: 'left' }, fillStyle]}
      />
    </View>
  );
}

export function OnboardingCarousel() {
  const insets = useSafeAreaInsets();
  const slides = ONBOARDING_SLIDES;

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const animatedActiveIndex = useSharedValue(0);
  const progress = useSharedValue(0);
  const isPaused = useSharedValue(false);
  const didLongPressRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const topInset = insets.top + 64;
  const bottomPadding = insets.bottom + BUTTONS_CLEARANCE;

  const goTo = useCallback(
    (next: number) => {
      const normalized = ((next % slides.length) + slides.length) % slides.length;
      cancelAnimation(progress);
      progress.value = 0;
      activeIndexRef.current = normalized;
      animatedActiveIndex.value = normalized;
      setActiveIndex(normalized);
    },
    [animatedActiveIndex, progress, slides.length],
  );

  const advance = useCallback(() => goTo(activeIndexRef.current + 1), [goTo]);
  const goBack = useCallback(() => goTo(activeIndexRef.current - 1), [goTo]);

  // Drive the active segment to full, then advance. Runs on every activeIndex change.
  const startTimer = useCallback(
    (fromProgress: number) => {
      const remaining = Math.round((1 - fromProgress) * AUTO_PLAY_INTERVAL_MS);
      if (remaining <= 0) {
        advance();
        return;
      }
      progress.value = withTiming(
        1,
        { duration: remaining, easing: Easing.linear },
        (finished) => {
          if (finished) runOnJS(advance)();
        },
      );
    },
    [advance, progress],
  );

  useEffect(() => {
    progress.value = 0;
    if (!isPaused.value) startTimer(0);
    return () => cancelAnimation(progress);
  }, [activeIndex, isPaused, progress, startTimer]);

  // Pause while backgrounded; resume the remaining time on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasInactive = appStateRef.current !== 'active';
      appStateRef.current = next;
      if (next !== 'active') {
        isPaused.value = true;
        cancelAnimation(progress);
      } else if (wasInactive) {
        didLongPressRef.current = false;
        isPaused.value = false;
        startTimer(Math.max(0, Math.min(progress.value, 1)));
      }
    });
    return () => sub.remove();
  }, [isPaused, progress, startTimer]);

  const handlePressIn = useCallback(() => {
    didLongPressRef.current = false;
    isPaused.value = true;
    cancelAnimation(progress);
  }, [isPaused, progress]);

  const handleLongPress = useCallback(() => {
    didLongPressRef.current = true;
  }, []);

  const handlePressOut = useCallback(() => {
    // A genuine hold just resumes where it paused; a quick tap is handled by onPress below.
    if (didLongPressRef.current) {
      isPaused.value = false;
      startTimer(Math.max(0, Math.min(progress.value, 1)));
    }
  }, [isPaused, progress, startTimer]);

  const handlePrev = useCallback(() => {
    if (didLongPressRef.current) return;
    isPaused.value = false;
    goBack();
  }, [goBack, isPaused]);

  const handleNext = useCallback(() => {
    if (didLongPressRef.current) return;
    isPaused.value = false;
    advance();
  }, [advance, isPaused]);

  return (
    <View className="flex-1">
      {slides.map((slide, index) => (
        <SlideLayer
          key={slide.key}
          slide={slide}
          index={index}
          activeIndex={animatedActiveIndex}
          isPaused={isPaused}
          topInset={topInset}
          bottomPadding={bottomPadding}
        />
      ))}

      {/* Fixed top overlay: progress bars + brand label, above every slide layer. */}
      <View
        className="absolute inset-x-0 top-0 px-6"
        style={{ paddingTop: insets.top + 10 }}
        pointerEvents="none"
      >
        <View className="w-full flex-row" style={{ gap: PROGRESS_BAR_GAP }}>
          {slides.map((slide, index) => (
            <ProgressBar
              key={slide.key}
              index={index}
              activeIndex={activeIndex}
              progress={progress}
            />
          ))}
        </View>
        <Text color="white" size="md" weight="semibold" className="mt-4 opacity-90">
          {BRAND_LABEL}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous slide"
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        onPress={handlePrev}
        style={styles.leftTapZone}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next slide"
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        onPress={handleNext}
        style={styles.rightTapZone}
      />
    </View>
  );
}

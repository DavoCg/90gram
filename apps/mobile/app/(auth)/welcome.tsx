import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { View } from '../../src/theme/uniwind';
import { Button } from '../../src/components/button';
import { OnboardingCarousel } from '../../src/components/onboarding';

// className only flows through a uniwind-wrapped animated component, not raw Animated.View.
const AnimatedView = Animated.createAnimatedComponent(View);

// Onboarding landing. A full-bleed stories carousel fills the screen; two buttons float at the
// bottom. "Create account" opens the method sheet (email / Google / Apple), "Log in" goes straight
// to the email step. Both ultimately run the same passwordless email-OTP flow; the only difference
// is the heading copy carried via the `intent` param.
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-black">
      {/* Force light status-bar content over the dark carousel, regardless of theme. */}
      <StatusBar style="light" />
      <OnboardingCarousel />

      <View
        className="absolute inset-x-0 bottom-0 gap-3 px-6"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Animated.View entering={FadeInDown.duration(400).easing(Easing.out(Easing.cubic))}>
          <Button
            label="Create account"
            color="white"
            variant="intense"
            shape="squircle"
            layout="flex"
            onPress={() => router.push('/auth-method')}
          />
        </Animated.View>
        <AnimatedView
          entering={FadeInDown.duration(400).delay(90).easing(Easing.out(Easing.cubic))}
          // Translucent squircle behind the soft button: without a backdrop-blur dep, the button's
          // own ~5% white fill is nearly invisible over the gradient, so this gives it a readable
          // base. Radius matches the button's `squircle` shape so the clip lines up.
          className="overflow-hidden rounded-2xl curve-continuous bg-white/10"
        >
          <Button
            label="Log in"
            color="white"
            variant="soft"
            shape="squircle"
            layout="flex"
            blur
            onPress={() => router.push({ pathname: '/email', params: { intent: 'signin' } })}
          />
        </AnimatedView>
      </View>
    </View>
  );
}

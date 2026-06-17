import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../src/components/button";
import { OnboardingCarousel } from "../../src/components/onboarding";
import { View } from "../../src/theme/uniwind";

// className only flows through a uniwind-wrapped animated component, not raw Animated.View.

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
				<Button
					label="Create account"
					color="white"
					variant="intense"
					layout="flex"
					onPress={() => router.push("/auth-method")}
				/>

				<Button
					label="Log in"
					color="white"
					variant="soft"
					layout="flex"
					blur
					onPress={() =>
						router.push({ pathname: "/email", params: { intent: "signin" } })
					}
				/>
			</View>
		</View>
	);
}

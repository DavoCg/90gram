import { useForm } from "@tanstack/react-form";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authClient } from "../../src/auth/client";
import { AppHeader } from "../../src/components/AppHeader";
import { Button } from "../../src/components/button";
import { Input } from "../../src/components/input";
import { Text } from "../../src/components/text";
import { View } from "../../src/theme/uniwind";

// Step 1 of the passwordless flow: collect an email and send a one-time code, then push to the
// code screen. The `intent` param (signup | signin) only tweaks the heading; the request is the
// same better-auth email-OTP call either way.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { intent } = useLocalSearchParams<{ intent?: string }>();
	const [serverError, setServerError] = useState<string | null>(null);

	const isSignup = intent !== "signin";

	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			setServerError(null);
			const email = value.email.trim();
			const { error } = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "sign-in",
			});
			if (error) {
				setServerError(error.message ?? "Could not send the code. Try again.");
				return;
			}
			router.push({ pathname: "/code", params: { email } });
		},
	});

	return (
		<View className="flex-1 bg-bg">
			{/* Override the landing's light status bar; these screens have a light background. */}
			<StatusBar style="auto" />
			<AppHeader showBack />
			{/* behavior="padding" pushes the docked footer above the keyboard via layout (robust here,
          unlike KeyboardStickyView's transform). keyboardVerticalOffset cancels the footer's
          bottom safe-area inset once the keyboard covers that area, so the button lands ~16px above
          the keyboard when open and insets.bottom + 16 above the home indicator when closed. */}

			<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
				{([canSubmit, isSubmitting]) => (
					<View
						className="flex-1 px-6"
						style={{ paddingBottom: insets.bottom + 16 }}
					>
						<View className="mt-2 mb-8">
							<Text size="3xl" weight="bold">
								{isSignup ? "What's your email?" : "Welcome back"}
							</Text>
							<Text color="neutral-soft" className="mt-2" multiline>
								We will send a code to this address to verify it is yours.
							</Text>
						</View>

						<form.Field
							name="email"
							validators={{
								onChange: ({ value }) =>
									EMAIL_RE.test(value.trim())
										? undefined
										: "Enter a valid email address.",
							}}
						>
							{(field) => {
								const showError =
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0;
								return (
									<Input
										size="lg"
										placeholder="you@example.com"
										value={field.state.value}
										onChangeText={field.handleChange}
										onBlur={field.handleBlur}
										autoFocus
										autoCapitalize="none"
										autoCorrect={false}
										autoComplete="email"
										keyboardType="email-address"
										inputMode="email"
										returnKeyType="send"
										editable={!isSubmitting}
										onSubmitEditing={() => void form.handleSubmit()}
										variant={showError ? "error" : "default"}
										helperText={
											showError ? field.state.meta.errors.join(", ") : undefined
										}
									/>
								);
							}}
						</form.Field>

						{serverError ? (
							<Text size="sm" color="critical" className="mt-3">
								{serverError}
							</Text>
						) : null}

						{/* Footer docked to the bottom (marginTop:auto). Negative offsets keep it above the
                bottom safe area when the keyboard is closed, and 16px above the keyboard when open. */}
						<KeyboardStickyView
							offset={{ closed: -insets.bottom - 16, opened: -16 }}
							style={{ marginTop: "auto" }}
						>
							<Button
								label="Send code"
								shape="squircle"
								layout="flex"
								loading={isSubmitting}
								disabled={isSubmitting || !canSubmit}
								onPress={() => void form.handleSubmit()}
							/>
						</KeyboardStickyView>
					</View>
				)}
			</form.Subscribe>
		</View>
	);
}

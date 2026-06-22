import { useForm } from "@tanstack/react-form";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
	const { t } = useTranslation("auth");

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
				setServerError(error.message ?? t("email.errorSend"));
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
			<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
				{([canSubmit, isSubmitting]) => (
					<View
						className="flex-1 px-6"
						style={{ paddingBottom: insets.bottom + 16 }}
					>
						<View className="mt-2 mb-8">
							<Text size="3xl" weight="bold">
								{isSignup ? t("email.titleSignup") : t("email.titleSignin")}
							</Text>
							<Text color="neutral-soft" className="mt-2" multiline>
								{t("email.subtitle")}
							</Text>
						</View>

						<form.Field
							name="email"
							validators={{
								onChange: ({ value }) =>
									EMAIL_RE.test(value.trim())
										? undefined
										: t("email.invalid"),
							}}
						>
							{(field) => {
								const showError =
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0;
								return (
									<Input
										size="lg"
										placeholder={t("email.placeholder")}
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
								label={t("email.sendCode")}
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

import {
	cloneElement,
	isValidElement,
	type ReactElement,
	useEffect,
	useRef,
} from "react";
import type { TextInput as RNTextInput } from "react-native";
import { useNavigation } from "expo-router";
import { useThemeColors } from "../../theme/colors";
import { TextInput, View } from "../../theme/uniwind";
import { Text } from "../text";
import { inputContainerRecipe, inputTextRecipe } from "./input-recipe";
import type { InputProps } from "./input-types";

// The app text field, ported from perp-companion. The label and helper render through this app's
// Text component; placeholder/selection/text colors come from useThemeColors() (the wrapped uniwind
// TextInput cannot read the CSS variables in className for those props). The field is vertically
// centered by the items-center row plus textAlignVertical; pass inputClassName="text-center" for a
// horizontally centered field (e.g. a one-time code).
export function Input({
	label,
	helperText,
	reserveHelperSpace,
	startSlot,
	endSlot,
	variant,
	size = "md",
	disabled,
	className,
	containerClassName,
	inputClassName,
	style,
	placeholderTextColor,
	selectionColor,
	autoFocus,
	ref,
	...rest
}: InputProps) {
	const colors = useThemeColors();
	const isError = variant === "error";

	// Defer autoFocus rather than handing it to the native TextInput: native autoFocus raises the
	// keyboard while the screen is still sliding in, so the keyboard rides in horizontally with the
	// push transition instead of sliding up. We focus on the stack's `transitionEnd` event so the
	// keyboard always animates up over a settled screen, with a timer as a fallback for cases where
	// no transition fires (already-mounted screen, or not inside a native stack).
	const innerRef = useRef<RNTextInput | null>(null);
	const navigation = useNavigation();
	const setRef = (node: RNTextInput | null) => {
		innerRef.current = node;
		if (typeof ref === "function") ref(node);
		else if (ref) ref.current = node;
	};

	useEffect(() => {
		if (!autoFocus) return;
		let done = false;
		let pending: ReturnType<typeof setTimeout> | undefined;
		// Focus a hair AFTER the screen settles, never on the transition's final frame: on iOS, a
		// focus() that lands while the push is still (barely) animating makes the keyboard slide in
		// horizontally with the screen instead of sliding up.
		const focusSoon = (delay: number) => {
			if (done) return;
			done = true;
			pending = setTimeout(() => innerRef.current?.focus(), delay);
		};
		// `transitionEnd` is a native-stack event that expo-router's generic navigation type omits,
		// so narrow to just the listener shape we use rather than reaching for `any`. Optional chaining
		// keeps a malformed event from throwing (which would silently leave us on the racing fallback).
		const nav = navigation as unknown as {
			addListener: (
				type: "transitionEnd",
				cb: (e?: { data?: { closing?: boolean } }) => void,
			) => () => void;
		};
		const unsubscribe = nav.addListener("transitionEnd", (e) => {
			if (!e?.data?.closing) focusSoon(50);
		});
		// Fallback for paths with no push transition (already-mounted screen, not in a native stack).
		const fallback = setTimeout(() => focusSoon(0), 700);
		return () => {
			unsubscribe();
			clearTimeout(fallback);
			if (pending) clearTimeout(pending);
		};
	}, [autoFocus, navigation]);

	const tintSlot = (slot: typeof startSlot) => {
		if (
			isValidElement(slot) &&
			typeof (slot as ReactElement<{ color?: string }>).props?.color ===
				"undefined"
		) {
			return cloneElement(slot as ReactElement<{ color?: string }>, {
				color: colors.muted,
			});
		}
		return slot;
	};

	return (
		<View className={containerClassName}>
			{label ? (
				<Text size="sm" weight="medium" className="mb-1">
					{label}
				</Text>
			) : null}
			<View
				className={inputContainerRecipe({ variant, size, disabled, className })}
			>
				{tintSlot(startSlot)}
				<TextInput
					{...rest}
					ref={setRef}
					className={inputTextRecipe({ size, className: inputClassName })}
					editable={!disabled}
					style={[{ color: colors.text }, style]}
					placeholderTextColor={placeholderTextColor ?? colors.muted}
					selectionColor={selectionColor ?? colors.accent}
					textAlignVertical="center"
					allowFontScaling={false}
				/>
				{tintSlot(endSlot)}
			</View>
			{reserveHelperSpace ? (
				<View className="h-5 justify-center">
					{helperText ? (
						<Text size="xs" color={isError ? "critical" : "neutral-soft"}>
							{helperText}
						</Text>
					) : null}
				</View>
			) : helperText ? (
				<Text
					size="xs"
					color={isError ? "critical" : "neutral-soft"}
					className="mt-1"
				>
					{helperText}
				</Text>
			) : null}
		</View>
	);
}

export type { InputProps, InputVariants } from "./input-types";

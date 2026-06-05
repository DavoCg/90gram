import { forwardRef } from "react";
import { Text as RNText } from "react-native";
import Animated from "react-native-reanimated";
import { textRecipe } from "./text-recipe";
import type { TextProps } from "./text-types";

export const Text = forwardRef<RNText, TextProps>(
	(
		{
			size = "md",
			color = "neutral",
			family = "polymath",
			variant = "default",
			weight = "medium",
			align,
			transform,
			className,
			multiline,
			tabularNums,
			decoration,
			style,
			...props
		},
		ref,
	) => {
		const resolvedClassName = textRecipe({
			size,
			color,
			weight,
			variant,
			family,
			transform,
			align,
			className,
			multiline,
			decoration,
			tabularNums,
		});

		return <RNText {...props} ref={ref} className={resolvedClassName} allowFontScaling={false} style={style} />;
	},
);

Text.displayName = "Text";

export const AnimatedText = Animated.createAnimatedComponent(Text);

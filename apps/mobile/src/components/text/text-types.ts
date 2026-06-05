import type { TextProps as RNTextProps } from "react-native";
import type { VariantProps } from "tailwind-variants";
import type { textRecipe } from "./text-recipe";

export type TextProps = VariantProps<typeof textRecipe> & RNTextProps;

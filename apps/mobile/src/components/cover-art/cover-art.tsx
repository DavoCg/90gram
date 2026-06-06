import type { StyleProp, ImageStyle } from "react-native";
import { Image } from "../../theme/uniwind";
import { BIG_COVER_RADIUS } from "../../theme/sizes";

type CoverArtProps = {
	/** Cover image URL, or null/undefined to show just the placeholder fill. */
	uri?: string | null;
	/** Square side length, in pixels. */
	size: number;
	/** Corner radius, in pixels. Defaults to the shared big-cover radius. */
	radius?: number;
	/** Extra classes (e.g. a shadow or margin) merged onto the image. */
	className?: string;
	style?: StyleProp<ImageStyle>;
};

/**
 * The one way to render album cover art: a square image with continuous-curve rounded corners and
 * a surface placeholder fill behind it (shown while loading or when there is no artwork). Sizing
 * and radius are explicit so every cover, big or small, rounds and scales consistently. Big covers
 * (the full player and the vinyl detail page) share `BIG_COVER_RADIUS` via the default.
 */
export function CoverArt({
	uri,
	size,
	radius = BIG_COVER_RADIUS,
	className,
	style,
}: CoverArtProps) {
	return (
		<Image
			source={uri ? { uri } : undefined}
			contentFit="cover"
			className={`curve-continuous bg-surface-2${className ? ` ${className}` : ""}`}
			style={[{ width: size, height: size, borderRadius: radius }, style]}
		/>
	);
}

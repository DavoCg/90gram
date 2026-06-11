import { useCallback, useEffect, useRef, useState } from "react";
import type { StyleProp, ImageStyle } from "react-native";
import { Image } from "../../theme/uniwind";
import { BIG_COVER_RADIUS } from "../../theme/sizes";

// Cross-dissolve length once we decide to animate at all.
const FADE_DURATION = 220;
// Grace window before the fade arms. An image that finishes loading sooner than this (from memory or
// disk cache, or just a fast network) swaps in with no animation; only a slow load fades.
const FADE_DELAY = 80;

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
 * Arms the cross-dissolve only for slow loads. On each new `uri` we start a short timer; if the image
 * loads before it fires (already cached or fast), the fade stays off and the cover appears instantly.
 * If the timer fires first the load is slow, so we enable the transition and let it dissolve in.
 */
function useFadeOnSlowLoad(uri: string | null | undefined) {
	const [fade, setFade] = useState(false);
	const loaded = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clear = useCallback(() => {
		if (timer.current) {
			clearTimeout(timer.current);
			timer.current = null;
		}
	}, []);

	useEffect(() => {
		loaded.current = false;
		setFade(false);
		clear();
		if (uri) {
			timer.current = setTimeout(() => {
				if (!loaded.current) setFade(true);
			}, FADE_DELAY);
		}
		return clear;
	}, [uri, clear]);

	const onLoad = useCallback(() => {
		loaded.current = true;
		clear();
	}, [clear]);

	return { fade, onLoad };
}

/**
 * The one way to render album cover art: a square image with continuous-curve rounded corners and
 * a surface placeholder fill behind it (shown while loading or when there is no artwork). Sizing
 * and radius are explicit so every cover, big or small, rounds and scales consistently. Big covers
 * (the full player and the vinyl detail page) share `BIG_COVER_RADIUS` via the default.
 *
 * `recyclingKey` is the uri so expo-image resets to the placeholder when LegendList reuses a row
 * view for a different vinyl, instead of flashing the previous cover until the new one downloads.
 * The cross-dissolve only arms for slow loads (see `useFadeOnSlowLoad`), so a cached or fast cover
 * appears instantly with no fade and only a genuinely slow download dissolves in.
 */
export function CoverArt({
	uri,
	size,
	radius = BIG_COVER_RADIUS,
	className,
	style,
}: CoverArtProps) {
	const { fade, onLoad } = useFadeOnSlowLoad(uri);

	return (
		<Image
			source={uri ? { uri } : undefined}
			recyclingKey={uri ?? undefined}
			contentFit="cover"
			onLoad={onLoad}
			transition={fade ? { duration: FADE_DURATION, effect: "cross-dissolve" } : null}
			className={`curve-continuous bg-surface-2${className ? ` ${className}` : ""}`}
			style={[{ width: size, height: size, borderRadius: radius }, style]}
		/>
	);
}

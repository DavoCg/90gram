import type { FavoriteTrackDto, VinylSummaryDto } from "@getvinyls/api-client";
import { use$ } from "@legendapp/state/react";
import { useRouter } from "expo-router";
import { Heart } from "lucide-react-native";
import { useCallback } from "react";
import { useFavorites } from "../../src/api/hooks";
import { audioEngine } from "../../src/audio/engine";
import { player$ } from "../../src/audio/store";
import { AppHeader } from "../../src/components/AppHeader";
import { CoverArt } from "../../src/components/cover-art";
import { EqualizerBars } from "../../src/components/equalizer-bars";
import { FavoriteButton } from "../../src/components/favorite-button";
import { Placeholder } from "../../src/components/Placeholder";
import { Text } from "../../src/components/text";
import { VinylRow } from "../../src/components/VinylRow";
import { useThemeColors } from "../../src/theme/colors";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	View,
} from "../../src/theme/uniwind";

// Leaves room at the bottom for the floating mini-player + the tab bar.
const LIST_BOTTOM_PADDING = 140;

function SectionTitle({ children }: { children: string }) {
	return (
		<Text
			size="sm"
			weight="semibold"
			color="neutral-soft"
			className="px-4 pb-1 pt-4"
		>
			{children}
		</Text>
	);
}

// A favorited track: cover + title + parent artist. Tapping the row plays just this track; the
// cover doubles as a shortcut into the parent vinyl page. The trailing heart un-favorites in place.
function FavoriteTrackRow({
	track,
	isCurrent,
	isPlaying,
	onPlay,
	onOpenVinyl,
}: {
	track: FavoriteTrackDto;
	isCurrent: boolean;
	isPlaying: boolean;
	onPlay: (track: FavoriteTrackDto) => void;
	onOpenVinyl: (vinylId: string) => void;
}) {
	const colors = useThemeColors();
	const playable = track.previewUrl !== null;
	return (
		<Pressable
			onPress={() => onPlay(track)}
			disabled={!playable}
			className="flex-row items-center gap-3 px-4 py-3"
		>
			<Pressable onPress={() => onOpenVinyl(track.vinyl.id)} hitSlop={6}>
				<CoverArt uri={track.vinyl.coverArtUrl} size={48} radius={8} />
			</Pressable>
			<View className="flex-1">
				<Text
					numberOfLines={1}
					weight="semibold"
					color={isCurrent ? "accent" : "neutral"}
				>
					{track.title}
				</Text>
				<Text numberOfLines={1} size="sm" color="neutral-soft">
					{track.vinyl.artist} · {track.vinyl.title}
				</Text>
			</View>
			{isCurrent ? (
				<EqualizerBars playing={isPlaying} color={colors.accent} size={14} />
			) : !playable ? (
				<Text size="xs" color="neutral-soft">
					No preview
				</Text>
			) : null}
			<FavoriteButton targetType="track" track={track} size={18} />
		</Pressable>
	);
}

export default function FavoritesScreen() {
	const router = useRouter();
	const { data, isLoading, isError, refetch } = useFavorites();
	const currentTrack = use$(player$.track);
	const currentVinylId = currentTrack?.vinylId;
	const currentTrackId = currentTrack?.id;
	const playWhenReady = use$(player$.playWhenReady);

	const onPressVinyl = useCallback(
		(vinyl: VinylSummaryDto) => router.push(`/vinyl/${vinyl.id}`),
		[router],
	);
	const onOpenVinyl = useCallback(
		(vinylId: string) => router.push(`/vinyl/${vinylId}`),
		[router],
	);
	const onPlayTrack = useCallback((track: FavoriteTrackDto) => {
		void audioEngine.playTrack(track);
	}, []);

	if (isLoading) {
		return (
			<View className="flex-1 bg-bg">
				<AppHeader title="Favorites" showBack={false} />
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator />
				</View>
			</View>
		);
	}

	if (isError || !data) {
		return (
			<View className="flex-1 bg-bg">
				<AppHeader title="Favorites" showBack={false} />
				<View className="flex-1 items-center justify-center gap-3 px-6">
					<Text align="center">Could not load your favorites.</Text>
					<Pressable
						onPress={() => void refetch()}
						className="rounded-full curve-continuous bg-accent px-5 py-2"
					>
						<Text color="white">Retry</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	if (data.vinyls.length === 0 && data.tracks.length === 0) {
		return (
			<Placeholder
				icon={Heart}
				title="Favorites"
				subtitle="Records you save will show up here."
			/>
		);
	}

	return (
		<View className="flex-1 bg-bg">
			<AppHeader title="Favorites" showBack={false} />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
			>
				{data.vinyls.length > 0 ? (
					<>
						<SectionTitle>Records</SectionTitle>
						{data.vinyls.map((vinyl) => (
							<VinylRow
								key={vinyl.id}
								vinyl={vinyl}
								isCurrent={vinyl.id === currentVinylId}
								isPlaying={playWhenReady}
								onPress={onPressVinyl}
							/>
						))}
					</>
				) : null}

				{data.tracks.length > 0 ? (
					<>
						<SectionTitle>Tracks</SectionTitle>
						{data.tracks.map((track) => (
							<FavoriteTrackRow
								key={track.id}
								track={track}
								isCurrent={track.id === currentTrackId}
								isPlaying={playWhenReady}
								onPlay={onPlayTrack}
								onOpenVinyl={onOpenVinyl}
							/>
						))}
					</>
				) : null}
			</ScrollView>
		</View>
	);
}

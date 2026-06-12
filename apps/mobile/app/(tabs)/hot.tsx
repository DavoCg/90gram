import { View } from "../../src/theme/uniwind";
import { AppHeader } from "../../src/components/AppHeader";

export default function HotScreen() {
	return (
		<View className="flex-1 bg-bg">
			<AppHeader title="Hot" showBack={false} />
		</View>
	);
}

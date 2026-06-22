import { useTranslation } from "react-i18next";
import { View } from "../../src/theme/uniwind";
import { AppHeader } from "../../src/components/AppHeader";

export default function HotScreen() {
	const { t } = useTranslation("common");
	return (
		<View className="flex-1 bg-bg">
			<AppHeader title={t("tabs.hot")} showBack={false} />
		</View>
	);
}

const {
  AndroidConfig,
  withAndroidColorsNight,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

// Paints the OS window with the themed app background so that during an OTA reload
// (Updates.reloadAsync) the native window keeps showing the app's background color instead of
// flashing white while the new JS bundle boots. expo-system-ui's SystemUI.setBackgroundColorAsync
// is a runtime JS call that does NOT survive a reload (the recreated native root view is white
// until the new bundle runs), so the color has to be baked into the native build. It follows the OS
// light/dark scheme, like the bootsplash; the app's JS-only dark preference can diverge from the OS,
// but matching the system scheme matches the splash and is the closest the native layer can get.
//
// These MUST match colors.ts (theme bg light/dark) so the native color is identical to what the app
// paints once JS returns, making the reload gap invisible rather than a wrong-colored flash.
const LIGHT = "#fdfdfc";
const DARK = "#111110";

// The Android color name expo-system-ui creates for `android.backgroundColor`. Setting that config
// key makes expo-system-ui add this color (light) to values/colors.xml and wire
// android:windowBackground on AppTheme. We only add the night-mode override here so dark mode shows
// the dark bg instead of expo-system-ui's single light value. Keep app.json's
// android.backgroundColor in sync with LIGHT.
const COLOR_NAME = "activityBackground";

const withAndroidNightBackground = (config) =>
  withAndroidColorsNight(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: COLOR_NAME,
      value: DARK,
    });
    return cfg;
  });

// iOS: set the UIWindow background to a dynamic UIColor. The window is created once at launch and
// outlives the RCTRootView, so on an OTA reload (when expo-updates swaps the root view) the window
// background shows through the gap. A dynamic UIColor resolves per the trait collection, so it
// tracks the OS light/dark scheme. (expo-system-ui's iOS root-view color is a single static value,
// which is why we set a dynamic one on the window ourselves.)
const hexToUIColor = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `UIColor(red: ${r}/255.0, green: ${g}/255.0, blue: ${b}/255.0, alpha: 1)`;
};

const MARKER = "// themed-native-background";
const ANCHOR = "window = UIWindow(frame: UIScreen.main.bounds)";

const withIosThemedBackground = (config) =>
  withDangerousMod(config, [
    "ios",
    (cfg) => {
      const appDelegate = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName ?? "",
        "AppDelegate.swift",
      );
      let contents = fs.readFileSync(appDelegate, "utf8");

      if (contents.includes(MARKER)) return cfg;
      if (!contents.includes(ANCHOR)) {
        throw new Error(
          `with-themed-native-background: could not find "${ANCHOR}" in AppDelegate.swift; ` +
            "the Expo template changed and this plugin needs updating.",
        );
      }

      const injection =
        `${ANCHOR}\n` +
        `    ${MARKER}: keep the OTA-reload gap themed instead of white\n` +
        `    window?.backgroundColor = UIColor { traits in\n` +
        `      traits.userInterfaceStyle == .dark ? ${hexToUIColor(DARK)} : ${hexToUIColor(LIGHT)}\n` +
        `    }`;

      contents = contents.replace(ANCHOR, injection);
      fs.writeFileSync(appDelegate, contents);
      return cfg;
    },
  ]);

module.exports = (config) => {
  config = withAndroidNightBackground(config);
  config = withIosThemedBackground(config);
  return config;
};

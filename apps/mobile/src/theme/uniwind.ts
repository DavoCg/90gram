// Uniwind-wrapped React Native primitives. `withUniwind` adds a typed `className`
// prop (mapping style -> className, contentContainerStyle -> contentContainerClassName,
// color props -> *ClassName). This is the typed path; we do NOT import the untyped
// `uniwind/components`. Style RN components with className via these.
import {
  ActivityIndicator as RNActivityIndicator,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  Text as RNText,
  View as RNView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { withUniwind } from 'uniwind';

export const View = withUniwind(RNView);
export const Text = withUniwind(RNText);
export const Pressable = withUniwind(RNPressable);
export const ScrollView = withUniwind(RNScrollView);
export const ActivityIndicator = withUniwind(RNActivityIndicator);
export const Image = withUniwind(ExpoImage);

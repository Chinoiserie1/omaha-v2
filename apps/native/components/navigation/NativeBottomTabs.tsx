import { withLayoutContext } from "expo-router";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";

const { Navigator } = createNativeBottomTabNavigator();

export const NativeBottomTabs = withLayoutContext(Navigator);

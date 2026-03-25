import { Platform } from "react-native";
import { Tabs, withLayoutContext } from "expo-router";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
import { Ionicons } from "@expo/vector-icons";
import { FloatingGlassTabBar } from "@/components/navigation/FloatingGlassTabBar";
import { ChatBottomAccessory } from "@/components/chat/ChatBottomAccessory";

const NativeTab = withLayoutContext(
  createNativeBottomTabNavigator().Navigator,
);

export default function TabsLayout() {
  if (Platform.OS === "ios") {
    return <IOSTabs />;
  }

  return <AndroidTabs />;
}

function IOSTabs() {
  return (
    <NativeTab>
      <NativeTab.Screen
        name="(home)"
        options={{
          title: "Tracker",
          tabBarIcon: { type: "sfSymbol", name: "waveform.path.ecg" },
        }}
      />
      <NativeTab.Screen
        name="(explore)"
        options={{
          title: "Explore",
          tabBarIcon: { type: "sfSymbol", name: "magnifyingglass" },
        }}
      />
      <NativeTab.Screen
        name="(quant)"
        options={{
          title: "Quant",
          tabBarIcon: {
            type: "sfSymbol",
            name: "chart.line.uptrend.xyaxis",
          },
          bottomAccessory: ({ placement }: { placement: "regular" | "inline" }) => (
            <ChatBottomAccessory placement={placement} />
          ),
        }}
      />
      <NativeTab.Screen
        name="(profile)"
        options={{
          title: "Profile",
          tabBarIcon: { type: "sfSymbol", name: "person" },
        }}
      />
    </NativeTab>
  );
}

function AndroidTabs() {
  return (
    <Tabs
      tabBar={(props) => <FloatingGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: "none",
        },
        sceneStyle: {
          backgroundColor: "#0F172A",
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Tracker",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(explore)"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(quant)"
        options={{
          title: "Quant",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

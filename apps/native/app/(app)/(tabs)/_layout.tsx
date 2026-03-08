import {
  Platform,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FloatingGlassTabBar } from "@/components/navigation/FloatingGlassTabBar";
import { NativeBottomTabs } from "@/components/navigation/NativeBottomTabs";
import { ChatSearchProvider, useChatSearch } from "@/contexts/chat-search";

export default function TabsLayout() {
  if (Platform.OS === "ios") {
    return (
      <ChatSearchProvider>
        <IOSTabs />
      </ChatSearchProvider>
    );
  }

  return <AndroidTabs />;
}

function IOSTabs() {
  const { setSearchText } = useChatSearch();

  return (
    <NativeBottomTabs
      screenOptions={{
        headerShown: false,
      }}
    >
      <NativeBottomTabs.Screen
        name="(home)"
        options={{
          title: "Tracker",
          tabBarIcon: { type: "sfSymbol", name: "waveform.path.ecg" },
        }}
      />
      <NativeBottomTabs.Screen
        name="(explore)"
        options={{
          title: "Explore",
          tabBarIcon: { type: "sfSymbol", name: "magnifyingglass" },
        }}
      />
      <NativeBottomTabs.Screen
        name="(quant)"
        options={{
          title: "Quant",
          tabBarIcon: { type: "sfSymbol", name: "chart.line.uptrend.xyaxis" },
        }}
      />
      <NativeBottomTabs.Screen
        name="(chat)"
        options={{
          tabBarSystemItem: "search",
          headerShown: true,
          title: "Chat",
          headerStyle: { backgroundColor: "#0F172A" },
          headerTintColor: "#FAFAFA",
          headerLargeTitleEnabled: true,
          headerLargeTitleStyle: {
            color: "#FAFAFA",
            fontWeight: "700",
          },
          headerLargeStyle: { backgroundColor: "#0F172A" },
          headerShadowVisible: false,
          headerSearchBarOptions: {
            placeholder: "Search messages...",
            textColor: "#FAFAFA",
            tintColor: "#FAFAFA",
            barTintColor: "rgba(255,255,255,0.08)",
            hideWhenScrolling: false,
            onChangeText: (
              e: NativeSyntheticEvent<TextInputFocusEventData>,
            ) => setSearchText(e.nativeEvent.text),
            onCancelButtonPress: () => setSearchText(""),
          },
        }}
      />
      <NativeBottomTabs.Screen
        name="(profile)"
        options={{
          title: "Profile",
          tabBarIcon: { type: "sfSymbol", name: "person" },
        }}
      />
    </NativeBottomTabs>
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
      <Tabs.Screen
        name="(chat)"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

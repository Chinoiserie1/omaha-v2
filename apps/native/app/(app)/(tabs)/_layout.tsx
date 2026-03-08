import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { Ionicons } from "@expo/vector-icons";
import { FloatingGlassTabBar } from "@/components/navigation/FloatingGlassTabBar";
import { ChatSearchProvider } from "@/contexts/chat-search";
import { ActiveTabProvider, useActiveTab } from "@/contexts/active-tab";

export default function TabsLayout() {
  if (Platform.OS === "ios") {
    return (
      <ActiveTabProvider>
        <ChatSearchProvider>
          <IOSTabs />
        </ChatSearchProvider>
      </ActiveTabProvider>
    );
  }

  return <AndroidTabs />;
}

function IOSTabs() {
  const { activeTab } = useActiveTab();
  const chatVisible = activeTab === "(quant)" || activeTab === "(chat)";

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Icon sf="waveform.path.ecg" />
        <Label>Tracker</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(explore)">
        <Icon sf="magnifyingglass" />
        <Label>Explore</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(quant)">
        <Icon sf="chart.line.uptrend.xyaxis" />
        <Label>Quant</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="(chat)"
        role="search"
        hidden={!chatVisible}
      />

      <NativeTabs.Trigger name="(profile)">
        <Icon sf="person" />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
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

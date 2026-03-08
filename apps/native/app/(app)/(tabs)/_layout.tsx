import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FloatingGlassTabBar } from "@/components/navigation/FloatingGlassTabBar";

export default function TabsLayout() {
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

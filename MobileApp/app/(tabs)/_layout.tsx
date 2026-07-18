import { Tabs } from "expo-router";
import { theme } from "@/theme/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.bluePrimary,
        tabBarInactiveTintColor: theme.colors.greyIcon,
        tabBarStyle: { backgroundColor: "white", borderTopColor: theme.colors.border, height: 90 },
        tabBarLabelStyle: { fontSize: 10 }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="milestones" options={{ title: "Milestones" }} />
      <Tabs.Screen name="vaccines" options={{ title: "Vaccines" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="reports" options={{ title: "Reports" }} />
    </Tabs>
  );
}

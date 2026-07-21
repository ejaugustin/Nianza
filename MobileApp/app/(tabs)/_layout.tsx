import { Tabs } from "expo-router";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

const tabIcons = {
  index: "home",
  milestones: "checkmark",
  vaccines: "shield",
  chat: "chat",
  reports: "doc.text"
} as const;

function TabIcon({ name, color }: { name: keyof typeof tabIcons; color: string }) {
  return <SfIcon name={tabIcons[name]} color={color} size={22} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.bluePrimary,
        tabBarInactiveTintColor: theme.colors.greyIcon,
        tabBarStyle: { backgroundColor: "white", borderTopColor: theme.colors.border, height: 90 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <TabIcon name="index" color={color} /> }} />
      <Tabs.Screen name="milestones" options={{ title: "Milestones", tabBarIcon: ({ color }) => <TabIcon name="milestones" color={color} /> }} />
      <Tabs.Screen name="vaccines" options={{ title: "Vaccines", tabBarIcon: ({ color }) => <TabIcon name="vaccines" color={color} /> }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ color }) => <TabIcon name="chat" color={color} /> }} />
      <Tabs.Screen name="reports" options={{ title: "Reports", tabBarIcon: ({ color }) => <TabIcon name="reports" color={color} /> }} />
    </Tabs>
  );
}

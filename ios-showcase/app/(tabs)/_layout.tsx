import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/theme/colors';

function TabBarBackground() {
  if (Platform.OS === 'ios') {
    return <BlurView intensity={80} tint="dark" style={{ flex: 1 }} />;
  }
  return null;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.brand,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : Colors.bg1,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          position: 'absolute',
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: ({ color }) => <TabIcon emoji="💬" color={color} /> }}
      />
      <Tabs.Screen
        name="analyze"
        options={{ title: 'Analyze', tabBarIcon: ({ color }) => <TabIcon emoji="🔍" color={color} /> }}
      />
      <Tabs.Screen
        name="generate"
        options={{ title: 'Generate', tabBarIcon: ({ color }) => <TabIcon emoji="✨" color={color} /> }}
      />
      <Tabs.Screen
        name="code"
        options={{ title: 'Code', tabBarIcon: ({ color }) => <TabIcon emoji="⌨️" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 18, opacity: color === Colors.brand ? 1 : 0.5 }}>{emoji}</Text>;
}

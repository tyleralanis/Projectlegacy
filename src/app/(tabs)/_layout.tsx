import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { useAppTheme } from '@/ui/theme';

const icons: Record<string, string> = { life: '◉', people: '◎', work: '▦', money: '◇', more: '•••' };

export default function TabsLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      initialRouteName="life"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingTop: 5, paddingBottom: 7 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: route.name === 'more' ? 16 : 20, lineHeight: 22, fontWeight: '700' }}>{icons[route.name] ?? '•'}</Text>,
      })}
    >
      <Tabs.Screen name="life" options={{ title: 'Life' }} />
      <Tabs.Screen name="people" options={{ title: 'People' }} />
      <Tabs.Screen name="work" options={{ title: 'Work' }} />
      <Tabs.Screen name="money" options={{ title: 'Money' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}

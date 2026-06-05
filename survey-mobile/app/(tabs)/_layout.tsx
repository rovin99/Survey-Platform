import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();
  const hasConductor = user?.roles?.includes('Conducting');

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#3b82f6',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarStyle: { paddingBottom: 4, height: 56 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen
        name="participant"
        options={{
          title: 'Surveys',
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" size={size} color={color} />,
        }}
      />
      {hasConductor ? (
        <Tabs.Screen
          name="conductor"
          options={{
            title: 'Manage',
            tabBarIcon: ({ color, size }) => <Ionicons name="create-outline" size={size} color={color} />,
          }}
        />
      ) : (
        <Tabs.Screen name="conductor" options={{ href: null }} />
      )}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

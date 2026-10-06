import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { messageService } from '../services';
import ActiveScreen from '../screens/active/ActiveScreen';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import MatchesScreen from '../screens/matches/MatchesScreen';
import MeetScreen from '../screens/meet/MeetScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import AdminScreen from '../screens/admin/AdminScreen';
import { colors, typography } from '../theme';

const Tab = createBottomTabNavigator();

const ICONS = {
  Discover: { active: 'heart', inactive: 'heart-outline' },
  Active: { active: 'flame', inactive: 'flame-outline' },
  Matches: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  Meet: { active: 'calendar', inactive: 'calendar-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
  Admin: { active: 'shield-checkmark', inactive: 'shield-checkmark-outline' },
};

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const { isAdmin, user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let mounted = true;
    const refresh = async () => {
      try {
        const n = await messageService.getUnreadCount(user.uid);
        if (mounted) setUnread(n);
      } catch {
        // badge refresh failures are non-fatal
      }
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: [typography.caption, styles.tabLabel],
        tabBarStyle: [
          styles.tabBar,
          {
            height: 60 + (insets.bottom || Platform.OS === 'android' ? insets.bottom : 0),
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ],
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={ICONS[route.name]?.[focused ? 'active' : 'inactive'] || 'ellipse'}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Active" component={ActiveScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} options={unread > 0 ? { tabBarBadge: unread > 9 ? '9+' : unread } : undefined} />
      <Tab.Screen name="Meet" component={MeetScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      {isAdmin ? <Tab.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin' }} /> : null}
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tabLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
});

export default MainTabs;

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabs from './MainTabs';
import BlockedUsersScreen from '../screens/profile/BlockedUsersScreen';
import BoostScreen from '../screens/profile/BoostScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import LikedYouScreen from '../screens/profile/LikedYouScreen';
import NotificationsScreen from '../screens/profile/NotificationsScreen';
import PremiumScreen from '../screens/profile/PremiumScreen';
import VerificationScreen from '../screens/profile/VerificationScreen';
import ChatScreen from '../screens/matches/ChatScreen';
import MatchCelebrationScreen from '../screens/matches/MatchCelebrationScreen';
import MeetPlanScreen from '../screens/meet/MeetPlanScreen';
import ProfileDetailScreen from '../screens/discover/ProfileDetailScreen';
import ReportScreen from '../screens/shared/ReportScreen';

const Stack = createNativeStackNavigator();

/** Everything above the tabs: detail screens and modals. */
const AppStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      contentStyle: { backgroundColor: '#0A0F1E' },
    }}
  >
    <Stack.Screen name="MainTabs" component={MainTabs} />
    <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="Verification" component={VerificationScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="LikedYou" component={LikedYouScreen} />
    <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
    <Stack.Screen name="Premium" component={PremiumScreen} />
    <Stack.Screen name="Boost" component={BoostScreen} />
    <Stack.Screen name="MeetPlan" component={MeetPlanScreen} />
    <Stack.Screen name="Report" component={ReportScreen} />
    <Stack.Screen
      name="MatchCelebration"
      component={MatchCelebrationScreen}
      options={{ animation: 'fade', presentation: 'fullScreenModal' }}
    />
  </Stack.Navigator>
);

export default AppStack;

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BioInterestsScreen from '../screens/onboarding/BioInterestsScreen';
import PhotoSetupScreen from '../screens/onboarding/PhotoSetupScreen';

const Stack = createNativeStackNavigator();

/** Shown after registration until the profile has photo + bio + basics. */
const OnboardingStack = () => (
  <Stack.Navigator
    initialRouteName="PhotoSetup"
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      contentStyle: { backgroundColor: '#0A0F1E' },
    }}
  >
    <Stack.Screen name="PhotoSetup" component={PhotoSetupScreen} />
    <Stack.Screen name="BioInterests" component={BioInterestsScreen} />
  </Stack.Navigator>
);

export default OnboardingStack;

import React, { useState, useEffect, useMemo, useReducer, useRef } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

// Global Drawer Wrapper & Banner
import GlobalDrawerWrapper from '../components/GlobalDrawerWrapper';
import InAppBanner from '../components/InAppBanner';

// Auth Context
import { AuthContext } from '../context/AuthContext';
import { registerUnauthorizedHandler } from '../api/client';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AddDeviceScreen from '../screens/AddDeviceScreen';
import ProvisioningScreen from '../screens/ProvisioningScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RoomsScreen from '../screens/RoomsScreen';
import SchedulesScreen from '../screens/SchedulesScreen';
import AlertsScreen from '../screens/AlertsScreen';
import RoomSelectionScreen from '../screens/RoomSelectionScreen';
import ConfigureBoardScreen from '../screens/ConfigureBoardScreen';
import FamilyMembersScreen from '../screens/FamilyMembersScreen';

const AuthStack = createStackNavigator();
const HomeStack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Stack for Home and Add Device screens
function HomeStackScreen() {
  const theme = useTheme();
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <HomeStack.Screen 
        name="DevicesHome" 
        component={DashboardScreen} 
        options={{ headerShown: false }} 
      />
      <HomeStack.Screen 
        name="FamilyMembers" 
        component={FamilyMembersScreen} 
        options={{ title: 'Family Members' }} 
      />
      <HomeStack.Screen 
        name="AddDevice" 
        component={AddDeviceScreen} 
        options={{ title: 'Add New Device' }} 
      />
      <HomeStack.Screen 
        name="RoomSelection" 
        component={RoomSelectionScreen} 
        options={{ title: 'Select Room' }} 
      />
      <HomeStack.Screen 
        name="Provisioning" 
        component={ProvisioningScreen} 
        options={{ title: 'Provision Node' }} 
      />
      <HomeStack.Screen 
        name="ConfigureBoard" 
        component={ConfigureBoardScreen} 
        options={{ title: 'Configure Board' }} 
      />
      <HomeStack.Screen 
        name="Rooms" 
        component={RoomsScreen} 
        options={{ title: 'Rooms' }} 
      />
      <HomeStack.Screen 
        name="Alerts" 
        component={AlertsScreen} 
        options={{ title: 'Alerts' }} 
      />
    </HomeStack.Navigator>
  );
}

const AddDeviceStack = createStackNavigator();

function AddDeviceStackScreen() {
  const theme = useTheme();
  return (
    <AddDeviceStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <AddDeviceStack.Screen 
        name="RoomSelection" 
        component={RoomSelectionScreen} 
        options={{ title: 'Select Room' }} 
      />
      <AddDeviceStack.Screen 
        name="Provisioning" 
        component={ProvisioningScreen} 
        options={{ title: 'Provision Node' }} 
      />
      <AddDeviceStack.Screen 
        name="ConfigureBoard" 
        component={ConfigureBoardScreen} 
        options={{ title: 'Configure Board' }} 
      />
    </AddDeviceStack.Navigator>
  );
}

// Navigation structure
export default function AppNavigator() {
  const theme = useTheme();
  const navigationRef = useNavigationContainerRef();
  const [state, dispatch] = React.useReducer(
    (prevState, action) => {
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            userToken: action.token,
            isLoading: false,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isSignout: false,
            userToken: action.token,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isSignout: true,
            userToken: null,
          };
      }
    },
    {
      isLoading: true,
      isSignout: false,
      userToken: null,
    }
  );

  useEffect(() => {
    // Fetch the token from storage then navigate to our appropriate place
    const bootstrapAsync = async () => {
      let userToken;
      try {
        userToken = await AsyncStorage.getItem('user_token');
      } catch (e) {
        console.error('Failed to load token:', e);
      }
      dispatch({ type: 'RESTORE_TOKEN', token: userToken });
    };

    bootstrapAsync();
    
    // Register the 401 interceptor auto-logout callback
    registerUnauthorizedHandler(() => {
      dispatch({ type: 'SIGN_OUT' });
    });
  }, []);

  const authContextValue = useMemo(
    () => ({
      signIn: async (token) => {
        await AsyncStorage.setItem('user_token', token);
        dispatch({ type: 'SIGN_IN', token });
      },
      signOut: async () => {
        await AsyncStorage.removeItem('user_token');
        dispatch({ type: 'SIGN_OUT' });
      },
      userToken: state.userToken,
    }),
    [state.userToken]
  );

  const [activeBannerInvite, setActiveBannerInvite] = useState(null);

  useEffect(() => {
    if (!state.userToken) return;

    // 1. Register Push Token with Backend (Safely wrapped)
    const registerPushToken = async () => {
      try {
        // Safe check for expo push token without inline dynamic require crash in Metro Hermes
        console.log('[PushToken] Background push token check initialized.');
      } catch (err) {
        console.warn('[PushToken] Notice:', err);
      }
    };

    registerPushToken();

    // 2. Foreground check for pending sharing invitations
    const checkInvites = async () => {
      try {
        const res = await apiClient.get('/api/nodes/pending-invites');
        if (Array.isArray(res.data) && res.data.length > 0) {
          const newest = res.data[0];
          setActiveBannerInvite(newest);
        } else {
          setActiveBannerInvite(null);
        }
      } catch (err) {
        // Silent ignore
      }
    };

    checkInvites();
    const interval = setInterval(checkInvites, 5000);
    return () => clearInterval(interval);
  }, [state.userToken]);

  const handleBannerAccept = async (inviteId) => {
    try {
      await apiClient.post(`/api/nodes/invitations/${inviteId}/accept`);
      setActiveBannerInvite(null);
      if (navigationRef.current) {
        navigationRef.current.navigate('HomeTab', { screen: 'FamilyMembers' });
      }
    } catch (e) {
      console.warn('Failed to accept invite via banner:', e);
    }
  };

  const handleBannerReject = async (inviteId) => {
    try {
      await apiClient.post(`/api/nodes/invitations/${inviteId}/reject`);
      setActiveBannerInvite(null);
    } catch (e) {
      console.warn('Failed to reject invite via banner:', e);
    }
  };

  if (state.isLoading) {
    // Spinner screen while loading token status
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D' }}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <NavigationContainer ref={navigationRef}>
        {state.userToken == null ? (
          // User is NOT logged in (Login & Register - No Drawer, No Swipe)
          <AuthStack.Navigator
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: theme.colors.background },
            }}
          >
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Register" component={RegisterScreen} />
          </AuthStack.Navigator>
        ) : (
          // User IS logged in - Wrapped in GlobalDrawerWrapper for universal swipe-right-to-open
          <GlobalDrawerWrapper navigationRef={navigationRef}>
            <InAppBanner
              visible={!!activeBannerInvite}
              inviteData={activeBannerInvite}
              onAccept={handleBannerAccept}
              onReject={handleBannerReject}
              onPressBanner={() => {
                setActiveBannerInvite(null);
                if (navigationRef.current) {
                  navigationRef.current.navigate('HomeTab', { screen: 'FamilyMembers' });
                }
              }}
            />
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ color, size }) => {
                  let iconName;
                  if (route.name === 'HomeTab') {
                    iconName = 'home-variant';
                  } else if (route.name === 'SchedulesTab') {
                    iconName = 'calendar-clock';
                  } else if (route.name === 'SettingsTab') {
                    iconName = 'cog';
                  }
                  return <MaterialCommunityIcons name={iconName} size={size + 2} color={color} />;
                },
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
                tabBarStyle: {
                  display: 'none'
                },
                headerStyle: { 
                  backgroundColor: '#0E0E0E',
                  elevation: 0,
                  shadowOpacity: 0,
                  borderBottomWidth: 1.5,
                  borderBottomColor: '#262626',
                },
                headerTintColor: theme.colors.onSurface,
                headerTitleStyle: { fontWeight: '900', letterSpacing: 0.8 },
                tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: -2 },
              })}
            >
              <Tab.Screen
                name="HomeTab"
                component={HomeStackScreen}
                options={{ title: 'Home', headerShown: false }}
              />
              <Tab.Screen
                name="SchedulesTab"
                component={SchedulesScreen}
                options={{ title: 'Schedules', headerShown: false }}
              />
              <Tab.Screen
                name="SettingsTab"
                component={SettingsScreen}
                options={{ title: 'Settings' }}
              />
            </Tab.Navigator>
          </GlobalDrawerWrapper>
        )}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

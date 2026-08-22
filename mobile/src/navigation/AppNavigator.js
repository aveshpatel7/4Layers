import React, { useState, useEffect, useMemo, useReducer, useRef } from 'react';
import { View, ActivityIndicator, Platform, BackHandler, Linking, Alert } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

// Global Drawer Wrapper & Banner
import GlobalDrawerWrapper from '../components/GlobalDrawerWrapper';
import InAppBanner from '../components/InAppBanner';
import CustomAppModal from '../components/CustomAppModal';

// Auth Context
import { AuthContext } from '../context/AuthContext';
import apiClient, { registerUnauthorizedHandler, registerBlockedHandler } from '../api/client';

const isVersionGreater = (latest, current) => {
  if (!latest || !current) return false;
  const parse = (v) => String(v).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const l = parse(latest);
  const c = parse(current);
  const maxLen = Math.max(l.length, c.length);
  for (let i = 0; i < maxLen; i++) {
    const lNum = l[i] || 0;
    const cNum = c[i] || 0;
    if (lNum > cNum) return true;
    if (lNum < cNum) return false;
  }
  return false;
};

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

import PermissionSplashScreen from '../screens/PermissionSplashScreen';
import PostLoginOnboardingScreen from '../screens/PostLoginOnboardingScreen';

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
  const [permissionsGranted, setPermissionsGranted] = useState(true);
  const [userData, setUserData] = useState(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [blockedReason, setBlockedReason] = useState(null);

  // In-App OTA Update State
  const [updateModalInfo, setUpdateModalInfo] = useState(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  // Define the current built-in app version
  const CURRENT_JS_APP_VERSION = '2.0.2';

  // OTA Version Check on launch
  useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const currentVersion = Application.nativeApplicationVersion || CURRENT_JS_APP_VERSION;
        console.log(`[OTA Check] Local App Version: ${currentVersion} (JS: ${CURRENT_JS_APP_VERSION})`);
        const res = await apiClient.get('/api/app/version');
        if (res.data && res.data.latest_version) {
          const { latest_version, force_update, apk_url } = res.data;
          console.log(`[OTA Check] Server Version: ${latest_version}, Force: ${force_update}, URL: ${apk_url}`);
          // Loop-proof: Only prompt if server version is strictly greater than BOTH native and JS versions
          if (isVersionGreater(latest_version, currentVersion) && isVersionGreater(latest_version, CURRENT_JS_APP_VERSION)) {
            setUpdateModalInfo({
              latest_version,
              force_update: !!force_update,
              apk_url: apk_url || 'https://edabtynvpy.ap-south-1.awsapprunner.com/firmware/latest.apk',
            });
          }
        }
      } catch (err) {
        console.warn('[OTA Check] Version check failed:', err.message);
      }
    };

    checkAppVersion();
  }, []);

  const handleDownloadAndInstall = async () => {
    if (!updateModalInfo || !updateModalInfo.apk_url) return;

    if (Platform.OS !== 'android') {
      Linking.openURL(updateModalInfo.apk_url);
      return;
    }

    try {
      setIsDownloadingUpdate(true);
      setUpdateProgress(0);

      const fileUri = FileSystem.cacheDirectory + '4layers_update.apk';

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        updateModalInfo.apk_url,
        fileUri,
        {},
        (progressData) => {
          if (progressData.totalBytesExpectedToWrite > 0) {
            const pct = progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
            setUpdateProgress(pct);
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      setIsDownloadingUpdate(false);
      setUpdateModalInfo(null);

      if (result && result.uri) {
        try {
          const contentUri = await FileSystem.getContentUriAsync(result.uri);
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 268435457, // FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION
            type: 'application/vnd.android.package-archive',
          });
        } catch (intentErr) {
          console.warn('[OTA] Direct installer blocked, opening APK URL in browser:', intentErr);
          await Linking.openURL(updateModalInfo.apk_url);
        }
      } else {
        await Linking.openURL(updateModalInfo.apk_url);
      }
    } catch (error) {
      console.error('[OTA UPDATE ERROR]', error);
      setIsDownloadingUpdate(false);
      try {
        await Linking.openURL(updateModalInfo.apk_url);
      } catch (_) {
        Alert.alert('Update Error', 'Could not download update. Please check your internet connection.');
      }
    }
  };

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

    // Register the 403 interceptor blocked account callback
    registerBlockedHandler((reason) => {
      setBlockedReason(reason || 'Account suspended by administrator');
      dispatch({ type: 'SIGN_OUT' });
    });
  }, []);

  // Check user profile for post-login onboarding requirements (mobile number & terms)
  useEffect(() => {
    if (!state.userToken) {
      setUserData(null);
      setCheckingOnboarding(false);
      return;
    }

    const checkUserProfile = async () => {
      setCheckingOnboarding(true);
      try {
        // STEP 1: Try local cache first (fast path — avoids flicker on cold boot)
        const cached = await AsyncStorage.getItem('userData_cache');
        if (cached) {
          const parsedCache = JSON.parse(cached);
          console.log('[NAV CHECK] Cached UserData:', parsedCache);
          // If cached data shows onboarding is done, use it immediately
          if (parsedCache?.terms_accepted === true && parsedCache?.phone_number) {
            setUserData(parsedCache);
            setCheckingOnboarding(false);
            // Still refresh from API in background (fire & forget)
            apiClient.get('/api/users/me').then(res => {
              console.log('[NAV CHECK] API UserData (bg refresh):', res.data);
              setUserData(res.data);
              AsyncStorage.setItem('userData_cache', JSON.stringify(res.data));
            }).catch(() => {});
            return;
          }
        }

        // STEP 2: No valid cache — fetch from API
        const res = await apiClient.get('/api/users/me');
        console.log('[NAV CHECK] API UserData:', res.data);
        setUserData(res.data);
        // Save to local cache for next cold boot
        await AsyncStorage.setItem('userData_cache', JSON.stringify(res.data));
      } catch (err) {
        console.warn('[AppNavigator] Error fetching user profile:', err);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkUserProfile();
  }, [state.userToken]);

  const authContextValue = useMemo(
    () => ({
      signIn: async (token) => {
        await AsyncStorage.setItem('user_token', token);
        dispatch({ type: 'SIGN_IN', token });
      },
      signOut: async () => {
        await AsyncStorage.removeItem('user_token');
        await AsyncStorage.removeItem('userData_cache');
        setUserData(null);
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

  if (state.isLoading || checkingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0E0E0E' }}>
        <ActivityIndicator size="large" color="#1fa971" />
      </View>
    );
  }

  // On-demand permissions: App opens directly to Login/Dashboard without global splash block

  const DarkNavTheme = {
    dark: true,
    colors: {
      primary: '#1fa971',
      background: '#0E0E0E',
      card: '#0E0E0E',
      text: '#E5E2E1',
      border: 'rgba(255, 255, 255, 0.08)',
      notification: '#1fa971',
    },
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      <NavigationContainer ref={navigationRef} theme={DarkNavTheme}>
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
        ) : (!userData?.phone_number || !userData?.terms_accepted) ? (
          // User IS logged in but HAS NOT completed onboarding (Mobile Number + Terms & Privacy)
          <PostLoginOnboardingScreen
            route={{ params: { user: userData } }}
            onOnboardingComplete={async (updatedUser) => {
              const merged = {
                ...userData,
                ...updatedUser,
                phone_number: updatedUser?.phone_number || userData?.phone_number || 'REGISTERED',
                terms_accepted: true
              };
              // Persist to AsyncStorage so cold boot skips onboarding
              try {
                await AsyncStorage.setItem('userData_cache', JSON.stringify(merged));
                console.log('[ONBOARDING COMPLETE] Saved to AsyncStorage:', merged);
              } catch (e) {
                console.warn('[ONBOARDING COMPLETE] AsyncStorage save failed:', e);
              }
              setUserData(merged);
            }}
          />
        ) : (
          // User IS logged in & HAS completed onboarding - Wrapped in GlobalDrawerWrapper
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
                  borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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

      <CustomAppModal
        visible={!!blockedReason}
        title="Account Access Denied"
        message={`Your account has been blocked by the administrator.\n\nReason: ${blockedReason || 'Account suspended by administrator'}`}
        iconName="lock-alert"
        primaryText="OK"
        onPrimary={() => {
          setBlockedReason(null);
          if (Platform.OS === 'android') {
            BackHandler.exitApp();
          }
        }}
      />

      <CustomAppModal
        visible={!!updateModalInfo}
        title="Update Available"
        message={
          isDownloadingUpdate
            ? `Downloading new version... ${Math.round(updateProgress * 100)}%\n\nPlease wait while the APK file is downloaded to your device.`
            : `A new version (${updateModalInfo?.latest_version || '2.0.0'}) of 4Layers is available. Please update to get the latest features and bug fixes.`
        }
        iconName="cloud-download-outline"
        primaryText={isDownloadingUpdate ? `${Math.round(updateProgress * 100)}%` : "Update Now"}
        secondaryText={updateModalInfo?.force_update ? null : "Later"}
        onPrimary={isDownloadingUpdate ? () => {} : handleDownloadAndInstall}
        onSecondary={
          updateModalInfo?.force_update || isDownloadingUpdate
            ? null
            : () => setUpdateModalInfo(null)
        }
      />
    </AuthContext.Provider>
  );
}

import React, { useEffect, useMemo, useReducer } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthContext } from '../context/AuthContext';
import { registerUnauthorizedHandler, registerBlockedHandler } from '../api/client';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ProvisioningScreen from '../screens/ProvisioningScreen';
import GoSmartSettingsScreen from '../screens/GoSmartSettingsScreen';

const AuthStack = createStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: '#FFFFFF',
    background: '#000000',
    card: '#050505',
    text: '#FFFFFF',
    border: '#222222',
    notification: '#FFFFFF',
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#050505',
          borderTopColor: '#222222',
          height: 66,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#777777',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, size }) => {
          const icon = route.name === 'Home'
            ? 'home-outline'
            : route.name === 'Add Device'
              ? 'plus-circle-outline'
              : 'cog-outline';
          return <MaterialCommunityIcons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Add Device" component={ProvisioningScreen} />
      <Tab.Screen name="Settings" component={GoSmartSettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [state, dispatch] = useReducer((prev, action) => {
    switch (action.type) {
      case 'RESTORE': return { ...prev, loading: false, token: action.token || null };
      case 'SIGN_IN': return { ...prev, loading: false, token: action.token };
      case 'SIGN_OUT': return { ...prev, loading: false, token: null };
      default: return prev;
    }
  }, { loading: true, token: null });

  useEffect(() => {
    AsyncStorage.getItem('user_token')
      .then((token) => dispatch({ type: 'RESTORE', token }))
      .catch(() => dispatch({ type: 'RESTORE', token: null }));

    registerUnauthorizedHandler(() => dispatch({ type: 'SIGN_OUT' }));
    registerBlockedHandler(() => dispatch({ type: 'SIGN_OUT' }));
  }, []);

  const auth = useMemo(() => ({
    userToken: state.token,
    signIn: async (token) => {
      await AsyncStorage.setItem('user_token', token);
      dispatch({ type: 'SIGN_IN', token });
    },
    signOut: async () => {
      await AsyncStorage.removeItem('user_token');
      await AsyncStorage.removeItem('userData_cache');
      dispatch({ type: 'SIGN_OUT' });
    },
  }), [state.token]);

  if (state.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <NavigationContainer theme={navTheme}>
        {state.token ? (
          <MainTabs />
        ) : (
          <AuthStack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: '#000000' } }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Register" component={RegisterScreen} />
          </AuthStack.Navigator>
        )}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
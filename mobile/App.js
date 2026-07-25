import 'react-native-gesture-handler';
import React, { Component } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';

// Polyfill global window and localStorage for paho-mqtt and native runtime stability
if (typeof window === 'undefined') {
  global.window = global;
}
if (!global.window.localStorage) {
  global.window.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('GLOBAL APP CRASH:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Application Error</Text>
          <Text style={styles.errorText}>
            {this.state.error ? this.state.error.toString() : 'An unexpected error occurred.'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

import { Text as RNText, TextInput as RNTextInput } from 'react-native';

// Set global font family defaults for all Text and TextInput components across the entire app
if (RNText.defaultProps) {
  RNText.defaultProps.style = [{ fontFamily: 'GoogleSansFlex-Regular' }, RNText.defaultProps.style];
} else {
  RNText.defaultProps = { style: { fontFamily: 'GoogleSansFlex-Regular' } };
}

if (RNTextInput.defaultProps) {
  RNTextInput.defaultProps.style = [{ fontFamily: 'GoogleSansFlex-Regular' }, RNTextInput.defaultProps.style];
} else {
  RNTextInput.defaultProps = { style: { fontFamily: 'GoogleSansFlex-Regular' } };
}

// Custom Material Design 3 Dark Theme for a premium modern Black + Green aesthetic with Google Sans Flex
const theme = {
  ...MD3DarkTheme,
  fonts: {
    ...MD3DarkTheme.fonts,
    displayLarge: { fontFamily: 'GoogleSansFlex-Bold' },
    displayMedium: { fontFamily: 'GoogleSansFlex-Bold' },
    displaySmall: { fontFamily: 'GoogleSansFlex-Bold' },
    headlineLarge: { fontFamily: 'GoogleSansFlex-Bold' },
    headlineMedium: { fontFamily: 'GoogleSansFlex-SemiBold' },
    headlineSmall: { fontFamily: 'GoogleSansFlex-SemiBold' },
    titleLarge: { fontFamily: 'GoogleSansFlex-SemiBold' },
    titleMedium: { fontFamily: 'GoogleSansFlex-Medium' },
    titleSmall: { fontFamily: 'GoogleSansFlex-Medium' },
    bodyLarge: { fontFamily: 'GoogleSansFlex-Regular' },
    bodyMedium: { fontFamily: 'GoogleSansFlex-Regular' },
    bodySmall: { fontFamily: 'GoogleSansFlex-Regular' },
    labelLarge: { fontFamily: 'GoogleSansFlex-Medium' },
    labelMedium: { fontFamily: 'GoogleSansFlex-Regular' },
    labelSmall: { fontFamily: 'GoogleSansFlex-Regular' },
  },
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#22C55E',          // Brand Dark Emerald Green (#22C55E)
    secondary: '#15803D',        // Secondary Darker Green
    background: '#0E0E0E',       // Image 1 Obsidian Dark Black
    surface: '#1C1B1B',          // Image 1 Glass Card Surface
    onSurface: '#E5E2E1',        // Image 1 Warm Off-White text
    onSurfaceVariant: '#9CA3AF',   // Muted gray text
    outline: '#262626',          // Muted border
    outlineVariant: '#333333',    // Dark border
    error: '#EF4444',            // Error Red
    errorContainer: '#7F1D1D',   // Dark red container
    onErrorContainer: '#FCA5A5', // Soft red text
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level1: '#1C1B1B',         // Card level 1
      level2: '#262626',         // Active state card overlay
    }
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    'GoogleSansFlex-Regular': require('./assets/fonts/GoogleSansFlex-Regular.ttf'),
    'GoogleSansFlex-Medium': require('./assets/fonts/GoogleSansFlex-Medium.ttf'),
    'GoogleSansFlex-SemiBold': require('./assets/fonts/GoogleSansFlex-SemiBold.ttf'),
    'GoogleSansFlex-Bold': require('./assets/fonts/GoogleSansFlex-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E0E0E', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          {/* Light status bar icons for dark background */}
          <StatusBar style="light" backgroundColor="#0D0D0D" />
          <AppNavigator />
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#0E0E0E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorText: {
    color: '#E5E2E1',
    fontSize: 14,
    textAlign: 'center',
  },
});

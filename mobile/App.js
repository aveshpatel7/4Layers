import 'react-native-gesture-handler';
import React, { Component } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';
import GlobalAlertModal from './src/components/GlobalAlertModal';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('GO SMART APP CRASH:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>GO SMART</Text>
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

// GO SMART visual system: monochrome only. No green/blue/red brand accents.
export const GO_SMART_THEME = {
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
    primary: '#FFFFFF',
    onPrimary: '#000000',
    primaryContainer: '#FFFFFF',
    onPrimaryContainer: '#000000',
    secondary: '#FFFFFF',
    onSecondary: '#000000',
    secondaryContainer: '#1A1A1A',
    onSecondaryContainer: '#FFFFFF',
    tertiary: '#FFFFFF',
    background: '#000000',
    surface: '#0A0A0A',
    surfaceVariant: '#141414',
    onBackground: '#FFFFFF',
    onSurface: '#FFFFFF',
    onSurfaceVariant: '#BDBDBD',
    outline: '#3A3A3A',
    outlineVariant: '#222222',
    error: '#FFFFFF',
    onError: '#000000',
    errorContainer: '#1A1A1A',
    onErrorContainer: '#FFFFFF',
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: '#000000',
      level1: '#0A0A0A',
      level2: '#111111',
      level3: '#161616',
      level4: '#1A1A1A',
      level5: '#1F1F1F',
    },
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={GO_SMART_THEME}>
          <StatusBar style="light" backgroundColor="#000000" translucent={false} />
          <View style={styles.appRoot}>
            <AppNavigator />
            <GlobalAlertModal />
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorText: {
    color: '#D0D0D0',
    fontSize: 14,
    textAlign: 'center',
  },
});

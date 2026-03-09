import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initNotifications } from './src/utils/downloadHelper';
import { OTPWidget } from '@msg91comm/sendotp-react-native';

const widgetId = "356963686841383631383739";
const tokenAuth = "437741TfeisHj168b7f80bP1";

export default function App() {
  useEffect(() => {
    initNotifications();
    OTPWidget.initializeWidget(widgetId, tokenAuth);
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

// Auth Context - Global authentication state management
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { authAPI } from '../api';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const AuthContext = createContext(null);

// Configure notifications handle behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [logoutToast, setLogoutToast] = useState(false);
    const [loading, setLoading] = useState(true); // START WITH TRUE (Blocking Load)
    const [isAuthenticated, setIsAuthenticated] = useState(false); // Default to false until proven otherwise

    // Use a ref for logout to keep the interceptor stable
    const logoutRef = useRef(null);

    // Check authentication on app start
    useEffect(() => {
        // Safety timeout - if auth check takes too long, proceed anyway
        const timeout = setTimeout(() => {
            console.log('Auth check timeout - proceeding without auth');
            setLoading(false);
        }, 3000);

        checkAuth().finally(() => clearTimeout(timeout));
    }, []);

    // Global Interceptor for 401 handling
    useEffect(() => {
        const interceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                // If the error is 401 and it's NOT a logout attempt itself (to avoid infinite loops)
                if (error.response?.status === 401 && !error.config?.url?.includes('/auth/logout')) {
                    console.log('Session expired or invalidated from another device. Triggering global logout...');
                    if (logoutRef.current) {
                        await logoutRef.current();
                    }
                }
                return Promise.reject(error);
            }
        );
        return () => api.interceptors.response.eject(interceptor);
    }, []); // Register ONCE and stay stable

    // Background polling to detect remote logout (Logout All)
    useEffect(() => {
        if (!isAuthenticated) return;

        // Check session every 15 seconds for HIGHER RESPONSIVENESS to "Logout All"
        const pollSession = async () => {
            try {
                await authAPI.getMe();
            } catch (error) {
                // The interceptor will catch 401 and trigger logout()
                if (__DEV__) console.log('Poll check: session invalidated');
            }
        };

        const intervalId = setInterval(pollSession, 15000);
        return () => clearInterval(intervalId);
    }, [isAuthenticated]);

    const registerForPushNotificationsAsync = async () => {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice || Platform.OS === 'android') {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return;
            }

            try {
                // Get the Expo Push Token mapping to FCM depending on setup
                // We use getting device push token to get raw FCM token directly
                const tokenData = await Notifications.getDevicePushTokenAsync();
                token = tokenData.data;
                console.log('FCM Push Token:', token);
            } catch (e) {
                console.log('Error getting push token:', e);
            }
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    };

    const checkAuth = async () => {
        try {
            // 1. Get data from local storage
            console.log('Checking storage for auth...');
            const [tokenStr, userStr] = await AsyncStorage.multiGet(['token', 'user']);
            const token = tokenStr[1];
            const savedUser = userStr[1] ? JSON.parse(userStr[1]) : null;

            console.log('Storage check:', token ? 'Token found' : 'No token', savedUser ? `User found (${savedUser.active_role})` : 'No user');

            if (token && savedUser) {
                // 2. Set state for logged in user
                setUser(savedUser);
                setIsAuthenticated(true);

                // 3. Verify in background (fire and forget)
                verifyTokenInBackground(token);
                // 4. Update push token on app start if they are logged in
                registerAndSavePushToken();
            } else {
                // No token, definitely logged out
                setIsAuthenticated(false);
                setUser(null);
            }
        } catch (error) {
            console.warn('Auth check failed:', error);
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            // ALWAYS unblock UI after check is done
            setLoading(false);
        }
    };

    const registerAndSavePushToken = async () => {
        const token = await registerForPushNotificationsAsync();
        if (token) {
            await updateProfile({ fcm_token: token });
        }
    };

    const verifyTokenInBackground = async (token) => {
        try {
            console.log('Verifying token in background...');
            // Add timeout to prevent getting stuck
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Auth check timeout')), 5000)
            );
            const response = await Promise.race([
                authAPI.getMe(),
                timeoutPromise
            ]);
            console.log('Background verification success');
            // Update user with latest data from server
            setUser(response.data);
            await AsyncStorage.setItem('user', JSON.stringify(response.data));
        } catch (error) {
            console.warn('Background verification failed:', error.message);
            // If token is invalid (401), we must logout
            if (error.response?.status === 401) {
                console.log('Token expired, logging out...');
                await logout();
            }
            // For other errors (network/timeout), we keep the user logged in 
            // (Offline mode support basically)
        }
    };

    const login = async (token, userData) => {
        try {
            console.log('Logging in with token:', token?.substring(0, 20) + '...');
            console.log('User data:', userData);
            await AsyncStorage.setItem('token', token);
            await AsyncStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            setIsAuthenticated(true);
            console.log('Login successful, isAuthenticated:', true);

            // Get and save push token upon login
            registerAndSavePushToken();
        } catch (error) {
            console.error('Login storage error:', error);
        }
    };

    const logout = useCallback(async () => {
        try {
            // Avoid redundant logout calls if already logged out
            if (!isAuthenticated && !user) return;

            // 1. Best-effort server logout BEFORE clearing local token
            // This ensures the token is still available in headers for the API call
            try {
                await authAPI.logout();
            } catch (e) {
                if (__DEV__) console.log('Server session already removed or inaccessible');
            }

            // 2. Immediately update state to trigger UI redirect to AuthStack
            setIsAuthenticated(false);
            setUser(null);
            setLogoutToast(true);

            // 3. Perform local cleanup
            await AsyncStorage.multiRemove(['token', 'user']);

            console.log('Logged out successfully (Server notified, State Reset & Storage Cleared)');
        } catch (error) {
            console.error('Logout error:', error);
        }
    }, [isAuthenticated, user]);

    // Keep the ref updated with the latest logout function
    useEffect(() => {
        logoutRef.current = logout;
    }, [logout]);

    const clearLogoutToast = () => setLogoutToast(false);

    const updateUser = async (userData) => {
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
    };

    const switchRole = async (role) => {
        try {
            const response = await authAPI.switchRole(role);
            console.log('Switch role response:', response.data);
            const updatedUser = response.data.user;
            if (updatedUser) {
                await updateUser(updatedUser);
            }
            return { success: true };
        } catch (error) {
            let message = error.response?.data?.detail || error.response?.data?.message || 'Admin access not provided or switch failed';
            if (!error.response || error.message === 'Network Error') {
                message = 'Switch failed due to Network error';
            }
            console.log('Switch role error:', message);
            return { success: false, message };
        }
    };

    const updateProfile = async (data) => {
        try {
            const response = await authAPI.updateProfile(data);
            console.log('Update profile response:', response.data);
            const updatedUser = response.data.user || response.data; // Handle different response formats

            // Merge with existing user data to preserve other fields
            const newUser = { ...user, ...updatedUser };
            await updateUser(newUser);
            return { success: true, message: 'Profile updated successfully' };
        } catch (error) {
            if (__DEV__) {
                console.log('Profile update failed:', error.response?.data?.detail || error.message);
            }
            return {
                success: false,
                message: error.response?.data?.detail || error.response?.data?.message || 'Failed to update profile'
            };
        }
    };

    const value = {
        user,
        loading,
        isAuthenticated,
        logoutToast,
        login,
        logout,
        updateUser,
        updateProfile,
        switchRole,
        checkAuth,
        clearLogoutToast,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;

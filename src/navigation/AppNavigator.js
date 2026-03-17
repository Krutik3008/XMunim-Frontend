// App Navigator - Main navigation configuration with proper auth handling
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking, ToastAndroid, Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { customerAPI } from '../api';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ShopOwnerDashboard from '../screens/shopowner/DashboardScreen';
import CustomerDetailScreen from '../screens/shopowner/CustomerDetailScreen';
import ServiceDetailScreen from '../screens/shopowner/ServiceDetailScreen';
import StaffDetailScreen from '../screens/shopowner/StaffDetailScreen';
import ProductsScreen from '../screens/shopowner/ProductsScreen';
import QRCodeScreen from '../screens/shopowner/QRCodeScreen';
import QRShareScreen from '../screens/shopowner/QRShareScreen';
import CustomerDashboardScreen from '../screens/customer/DashboardScreen';
import ServiceLedgerDetailScreen from '../screens/customer/ServiceLedgerDetailScreen';
import StaffLedgerDetailScreen from '../screens/customer/StaffLedgerDetailScreen';
import EditProfileScreen from '../screens/customer/account/EditProfileScreen';
import NotificationsScreen from '../screens/customer/account/NotificationsScreen';
import PrivacySecurityScreen from '../screens/customer/account/PrivacySecurityScreen';
import HelpSupportScreen from '../screens/customer/account/HelpSupportScreen';
import AboutScreen from '../screens/customer/account/AboutScreen';
import PoliciesScreen from '../screens/customer/account/PoliciesScreen';
import AdminPanelScreen from '../screens/admin/AdminPanelScreen';
import AdminCustomerDetailScreen from '../screens/admin/AdminCustomerDetailScreen';
import AdminShopDetailsScreen from '../screens/admin/AdminShopDetailsScreen';
import CreateShopScreen from '../screens/shopowner/CreateShopScreen';

const Stack = createNativeStackNavigator();

// Loading Screen
const LoadingScreen = () => (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.loadingText}>Loading...</Text>
    </View>
);

// Auth Navigator (for non-authenticated users)
const AuthNavigator = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
);

// Main App Navigator (for authenticated users)
const MainNavigator = ({ initialRoute }) => (
    <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
    >
        {/* Shop Owner Dashboard - Has its own built-in bottom tabs */}
        <Stack.Screen name="ShopOwnerDashboard" component={ShopOwnerDashboard} />

        {/* Shop Owner Additional Screens */}
        <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
        <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
        <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
        <Stack.Screen name="Products" component={ProductsScreen} />
        <Stack.Screen name="QRCode" component={QRCodeScreen} />
        <Stack.Screen name="QRShare" component={QRShareScreen} />
        <Stack.Screen name="CreateShop" component={CreateShopScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />

        {/* Customer Dashboard - Has its own built-in bottom tabs */}
        <Stack.Screen name="CustomerDashboard" component={CustomerDashboardScreen} />
        <Stack.Screen name="ServiceLedgerDetail" component={ServiceLedgerDetailScreen} />
        <Stack.Screen name="StaffLedgerDetail" component={StaffLedgerDetailScreen} />

        {/* Customer Account Screens */}
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="Policies" component={PoliciesScreen} />

        {/* Admin Screens */}
        <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
        <Stack.Screen name="AdminCustomerDetail" component={AdminCustomerDetailScreen} />
        <Stack.Screen name="AdminShopDetails" component={AdminShopDetailsScreen} />
    </Stack.Navigator>
);

// Root Navigator
const AppNavigator = () => {
    const { isAuthenticated, user, loading } = useAuth();

    React.useEffect(() => {
        const handleDeepLink = (event) => {
            let url = event.url;
            if (url && url.includes('verify-customer')) {
                showVerificationToast(url);
            }
        };

        const checkInitialUrl = async () => {
            const initialUrl = await Linking.getInitialURL();
            if (initialUrl && initialUrl.includes('verify-customer')) {
                showVerificationToast(initialUrl);
            }
        };

        const showVerificationToast = async (url) => {
            try {
                // Extract customer_id from url: xmunim://verify-customer/ID
                const parts = url.split('/');
                const customerId = parts[parts.length - 1];

                if (customerId) {
                    const response = await customerAPI.verifyCustomer(customerId);
                    if (response.data && response.data.success) {
                        const shopName = response.data.shop_name || 'XMunim';
                        if (Platform.OS === 'android') {
                            ToastAndroid.show(`✓ Customer successfully verified for Shop ${shopName}`, ToastAndroid.LONG);
                        } else {
                            Alert.alert('Success', `Customer successfully verified for Shop ${shopName}`);
                        }
                    } else {
                        if (Platform.OS === 'android') {
                            ToastAndroid.show('Verification failed. Please try again.', ToastAndroid.LONG);
                        } else {
                            Alert.alert('Error', 'Verification failed. Please try again.');
                        }
                    }
                }
            } catch (error) {
                console.error('Verification failed via deep link:', error);
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Verification failed. Please try again.', ToastAndroid.LONG);
                } else {
                    Alert.alert('Error', 'Verification failed. Please try again.');
                }
            }
        };

        const linkingSubscription = Linking.addEventListener('url', handleDeepLink);
        checkInitialUrl();

        return () => {
            linkingSubscription.remove();
        };
    }, []);

    console.log('AppNavigator render:', { isAuthenticated, userId: user?.id, loading });

    if (loading) {
        return <LoadingScreen />;
    }

    const getInitialRoute = () => {
        if (user?.active_role === 'admin') return 'AdminPanel';
        if (user?.active_role === 'shop_owner') return 'ShopOwnerDashboard';
        return 'CustomerDashboard';
    };

    return (
        <NavigationContainer>
            {isAuthenticated ? (
                <MainNavigator initialRoute={getInitialRoute()} />
            ) : (
                <AuthNavigator />
            )}
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.gray[50],
    },
    loadingText: {
        marginTop: 10,
        color: colors.gray[600],
    },
});

export default AppNavigator;

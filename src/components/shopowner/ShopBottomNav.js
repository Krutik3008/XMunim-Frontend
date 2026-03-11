import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const TabButton = ({ name, icon, label, isActive, onPress }) => (
    <TouchableOpacity
        style={styles.navItemWrapper}
        onPress={onPress}
    >
        {isActive ? (
            <LinearGradient
                colors={['#EFF6FF', '#DBEAFE']} // Light blue shades
                style={styles.navItemActiveGradient}
            >
                <Ionicons
                    name={isActive ? icon.replace('-outline', '') : icon}
                    size={20}
                    color="#3B82F6"
                />
                <Text style={styles.navTextActive}>{label}</Text>
            </LinearGradient>
        ) : (
            <View style={styles.navItem}>
                <Ionicons
                    name={icon}
                    size={20}
                    color="#6B7280"
                />
                <Text style={styles.navText}>{label}</Text>
            </View>
        )}
    </TouchableOpacity>
);

// import React from 'react'; // Already verified context
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ShopBottomNav = ({ activeTab = 'home', onTabPress }) => {
    const navigation = useNavigation();
    const route = useRoute();
    const insets = useSafeAreaInsets();

    // Default navigation handler if none provided
    const handlePress = (tab) => {
        if (onTabPress) {
            onTabPress(tab);
            return;
        }

        // Basic navigation logic based on tab name
        // Adjust route names as per your actual navigation structure
        switch (tab) {
            case 'home':
                navigation.navigate('ShopOwnerDashboard', { tab: 'home' });
                break;
            case 'products':
                navigation.navigate('ShopOwnerDashboard', { tab: 'products' });
                break;
            case 'customers':
                // Navigate to the customers tab in Dashboard
                navigation.navigate('ShopOwnerDashboard', { tab: 'customers' });
                break;
            case 'services':
                navigation.navigate('ShopOwnerDashboard', { tab: 'services' }); // Services is a tab in Dashboard
                break;
            case 'transactions':
                navigation.navigate('ShopOwnerDashboard', { tab: 'transactions' }); // Transactions is a tab in Dashboard
                break;
            case 'account':
                navigation.navigate('ShopOwnerDashboard', { tab: 'account' }); // Account is a tab in Dashboard
                break;
            default:
                break;
        }
    };

    return (
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10), height: 60 + Math.max(insets.bottom, 10) }]}>
            <TabButton
                name="home"
                icon="home-outline"
                label="Home"
                isActive={activeTab === 'home'}
                onPress={() => handlePress('home')}
            />
            <TabButton
                name="products"
                icon="cube-outline"
                label="Products"
                isActive={activeTab === 'products'}
                onPress={() => handlePress('products')}
            />
            <TabButton
                name="customers"
                icon="people-outline"
                label="Customers"
                isActive={activeTab === 'customers'}
                onPress={() => handlePress('customers')}
            />
            <TabButton
                name="services"
                icon="briefcase-outline"
                label="Services"
                isActive={activeTab === 'services'}
                onPress={() => handlePress('services')}
            />
            <TabButton
                name="transactions"
                icon="receipt-outline"
                label="Transactions"
                isActive={activeTab === 'transactions'}
                onPress={() => handlePress('transactions')}
            />
            <TabButton
                name="account"
                icon="person-outline"
                label="Account"
                isActive={activeTab === 'account'}
                onPress={() => handlePress('account')}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
        elevation: 8,
        height: 65,
        zIndex: 1000,
    },
    navItemWrapper: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        gap: 4,
    },
    navItemActiveGradient: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        gap: 4,
    },
    navText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#6B7280',
    },
    navTextActive: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#3B82F6',
    },
});

export default ShopBottomNav;

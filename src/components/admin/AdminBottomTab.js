import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const AdminBottomTab = ({ activeView, onTabPress, onLogout }) => {
    const insets = useSafeAreaInsets();

    const navigationItems = [
        {
            id: 'dashboard',
            name: 'Home',
            icon: 'grid-outline',
            Lib: Ionicons
        },
        {
            id: 'users',
            name: 'Users',
            icon: 'person-outline',
            Lib: Ionicons
        },
        {
            id: 'shops',
            name: 'Businesses',
            icon: 'storefront-outline',
            Lib: Ionicons
        },
        {
            id: 'customers',
            name: 'Members',
            icon: 'people-outline',
            Lib: Ionicons
        },
        {
            id: 'roles',
            name: 'Roles',
            icon: 'account-cog-outline',
            Lib: MaterialCommunityIcons
        }
    ];

    return (
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10), height: 65 + Math.max(insets.bottom, 10) }]}>
            <View style={styles.navContainer}>
                {navigationItems.map((item) => {
                    const isActive = activeView === item.id;
                    const IconLib = item.Lib || Ionicons;
                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.navItemWrapper}
                            onPress={() => onTabPress(item.id)}
                        >
                            {isActive ? (
                                <LinearGradient
                                    colors={['#F3E8FF', '#EFF6FF']} // purple-50 to blue-50
                                    style={styles.navItemActiveGradient}
                                >
                                    <IconLib
                                        name={item.icon}
                                        size={20}
                                        color="#7C3AED"
                                    />
                                    <Text style={styles.navTextActive}>
                                        {item.name}
                                    </Text>
                                </LinearGradient>
                            ) : (
                                <View style={styles.navItem}>
                                    <IconLib
                                        name={item.icon}
                                        size={20}
                                        color="#6B7280"
                                    />
                                    <Text style={styles.navText}>
                                        {item.name}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}

                {/* Logout Button in Navbar */}
                <TouchableOpacity
                    style={styles.navItemWrapper}
                    onPress={onLogout}
                >
                    <View style={styles.navItem}>
                        <Ionicons
                            name="log-out-outline"
                            size={20}
                            color="#EF4444"
                        />
                        <Text style={[styles.navText, { color: '#EF4444' }]}>
                            Logout
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        elevation: 8,
        height: 65,
        zIndex: 1000,
    },
    navContainer: {
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
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
        color: '#7C3AED',
    },
});

export default AdminBottomTab;

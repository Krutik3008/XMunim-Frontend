import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView, Platform, Alert, Keyboard, BackHandler, ActivityIndicator, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { adminAPI } from '../../api';
import AdminDashboard from './AdminDashboard';
import AdminUserManagement from './AdminUserManagement';
import AdminShopManagement from './AdminShopManagement';
import AdminCustomerManagement from './AdminCustomerManagement';
import AdminRoleManagement from './AdminRoleManagement';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const AdminPanelScreen = () => {
    const [activeView, setActiveView] = useState('dashboard');
    const { user, logout, switchRole } = useAuth();
    const navigation = useNavigation();
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [stats, setStats] = useState({ total_users: 0 });
    const [refreshingStats, setRefreshingStats] = useState(false);
    const insets = useSafeAreaInsets();
    const route = useRoute(); // Need route for params

    // Toast notification state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [toastType, setToastType] = useState('success');
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef(null);

    const showToast = (message, type = 'success') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);

        // If already visible, pulse it and update
        if (toastVisible) {
            setToastMessage(message);
            setToastType(type);

            // Re-trigger the spring animation to show "activity"
            toastAnim.setValue(0.8); // Start slightly smaller for pulse
            Animated.spring(toastAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
            }).start();
        } else {
            setToastMessage(message);
            setToastType(type);
            setToastVisible(true);
            toastAnim.setValue(0);
            Animated.spring(toastAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }).start();
        }

        toastTimer.current = setTimeout(() => {
            Animated.timing(toastAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setToastVisible(false));
        }, 3500); // Slightly longer duration
    };

    useFocusEffect(
        useCallback(() => {
            if (route.params?.successMessage) {
                showToast(route.params.successMessage);
                navigation.setParams({ successMessage: undefined });
            }
        }, [route.params?.successMessage])
    );

    const fetchStats = async (dataOrEvent) => {
        // If data is passed directly (from Dashboard), use it to update stats without api call
        if (dataOrEvent && dataOrEvent.total_users !== undefined) {
            setStats(dataOrEvent);
            return;
        }

        try {
            setRefreshingStats(true);
            const response = await adminAPI.getDashboard();
            if (response.data) {
                setStats(response.data);
            }
        } catch (error) {
            showToast('Unable to refresh dashboard stats', 'error');
        } finally {
            setRefreshingStats(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []); // Removed activeView dependency to prevent auto-reload on tab switch

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setKeyboardVisible(true);
            }
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
            }
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    // Android hardware back button: return to dashboard from other tabs
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (activeView !== 'dashboard') {
                setActiveView('dashboard');
                return true;
            }
            return false;
        });
        return () => backHandler.remove();
    }, [activeView]);

    const navigationItems = [
        {
            id: 'dashboard',
            name: 'Home',
            icon: 'grid-outline',
            component: AdminDashboard,
            Lib: Ionicons
        },
        {
            id: 'users',
            name: 'Users',
            icon: 'person-outline',
            component: AdminUserManagement,
            Lib: Ionicons
        },
        {
            id: 'shops',
            name: 'Businesses',
            icon: 'storefront-outline',
            component: AdminShopManagement,
            Lib: Ionicons
        },
        {
            id: 'customers',
            name: 'Members',
            icon: 'people-outline', // Updated to match domain
            component: AdminCustomerManagement,
            Lib: Ionicons
        },
        {
            id: 'roles',
            name: 'Roles',
            icon: 'account-cog-outline', // Web uses UserCog
            component: AdminRoleManagement,
            Lib: MaterialCommunityIcons
        }
    ];

    const activeItem = navigationItems.find(item => item.id === activeView);
    const ActiveComponent = activeItem?.component || AdminDashboard;

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: logout }
            ]
        );
    };

    const handleRoleSwitch = async (role) => {
        setShowRoleDropdown(false);
        if (role !== user?.active_role) {
            const result = await switchRole(role);
            if (result.success) {
                const message = `Role switched to ${role === 'customer' ? 'User' : 'Business'}`;
                if (role === 'customer') {
                    navigation.reset({ index: 0, routes: [{ name: 'CustomerDashboard', params: { successMessage: message } }] });
                } else if (role === 'shop_owner') {
                    navigation.reset({ index: 0, routes: [{ name: 'ShopOwnerDashboard', params: { successMessage: message } }] });
                }
            } else {
                showToast(result.message || 'Role switch failed', 'error');
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header - Matching Web Mobile Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                        {activeView !== 'dashboard' && (
                            <TouchableOpacity onPress={() => setActiveView('dashboard')} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={20} color="#374151" />
                            </TouchableOpacity>
                        )}
                        <LinearGradient
                            colors={['#7C3AED', '#2563EB']}
                            style={styles.logoIcon}
                        >
                            <Ionicons name="settings" size={12} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.headerTitle}>XMunim Admin</Text>
                    </View>

                    <View style={styles.headerRight}>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>
                                {user?.active_role === 'admin' ? '👑' :
                                    user?.active_role === 'shop_owner' ? '🏪' : '👤'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.profileContainer}
                            onPress={() => setShowRoleDropdown(!showRoleDropdown)}
                        >
                            <LinearGradient
                                colors={['#7C3AED', '#2563EB']}
                                style={styles.avatarGradient}
                            >
                                <Text style={styles.avatarText}>
                                    {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                                </Text>
                            </LinearGradient>
                            <Text style={styles.headerUserName} numberOfLines={1}>
                                {user?.name ? user.name.split(' ')[0] : 'Admin'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Status Bar */}
                <View style={styles.statusBar}>
                    <View style={styles.statusGroup}>
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>Status: </Text>
                            <Text style={styles.statusValue}>Active</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.statusItem}
                            onPress={fetchStats}
                            disabled={refreshingStats}
                        >
                            <Text style={styles.statusLabel}>Users: </Text>
                            <Text style={styles.statusValueBlack}>{stats.total_users}</Text>
                            {refreshingStats && (
                                <ActivityIndicator size="small" color="#7C3AED" style={{ marginLeft: 4 }} />
                            )}
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.dateText}>
                        {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </Text>
                </View>
            </View>

            {/* Role Dropdown - Positioned Absolutely over content */}
            {showRoleDropdown && (
                <>
                    <TouchableOpacity
                        style={styles.backdrop}
                        activeOpacity={1}
                        onPress={() => setShowRoleDropdown(false)}
                    />
                    <View style={styles.roleDropdown}>
                        <View style={styles.dropdownHeader}>
                            <Text style={styles.dropdownUserName}>{user?.name}</Text>
                            <Text style={styles.dropdownUserRole}>Super Administrator</Text>
                        </View>
                        <View style={styles.dropdownDivider} />
                        <TouchableOpacity
                            style={[styles.roleOption, user?.active_role === 'customer' && styles.roleOptionActive]}
                            onPress={() => handleRoleSwitch('customer')}
                        >
                            <Ionicons name="person-outline" size={18} color="#3B82F6" />
                            <Text style={styles.roleOptionText}>User View</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.roleOption, user?.active_role === 'shop_owner' && styles.roleOptionActive]}
                            onPress={() => handleRoleSwitch('shop_owner')}
                        >
                            <Ionicons name="storefront-outline" size={18} color="#8B5CF6" />
                            <Text style={styles.roleOptionText}>Business View</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* Content Area with Dark Gradient Background */}
            <LinearGradient
                colors={['#581c87', '#1e3a8a', '#312e81']} // Purple-900 to Indigo-900 approximation
                style={[styles.content, isKeyboardVisible && { marginBottom: 0 }, { marginBottom: isKeyboardVisible ? 0 : 65 + Math.max(insets.bottom, 10) }]}
            >
                <ActiveComponent onRefreshStats={fetchStats} showToast={showToast} />
            </LinearGradient>

            {/* Bottom Navigation - Fixed - Matches Web Mobile */}
            {!isKeyboardVisible && (
                <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10), height: 65 + Math.max(insets.bottom, 10) }]}>
                    <View style={styles.navContainer}>
                        {navigationItems.map((item) => {
                            const isActive = activeView === item.id;
                            const IconLib = item.Lib || Ionicons;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.navItemWrapper}
                                    onPress={() => setActiveView(item.id)}
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
                            onPress={handleLogout}
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
            )}
            {/* Toast Notification */}
            {toastVisible && (
                <Animated.View
                    style={[
                        styles.toastContainer,
                        {
                            opacity: toastAnim,
                            transform: [{
                                translateY: toastAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [20, 0]
                                })
                            }]
                        }
                    ]}
                >
                    <View style={styles.toastContent}>
                        <View style={[styles.toastIcon, toastType === 'error' && { backgroundColor: '#EF4444' }]}>
                            <Ionicons name={toastType === 'error' ? "alert-circle" : "checkmark-circle"} size={20} color="#fff" />
                        </View>
                        <Text style={styles.toastText}>{toastMessage}</Text>
                    </View>
                </Animated.View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF', // Header part is white, active content is gradient
        paddingTop: Platform.OS === 'android' ? 25 : 0,
    },
    header: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        zIndex: 10,
        paddingBottom: 4,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        padding: 4,
        marginRight: 8,
    },
    logoIcon: {
        width: 24,
        height: 24,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#7C3AED',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    roleBadge: {
        backgroundColor: '#F3E8FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 8,
    },
    roleBadgeText: {
        fontSize: 12,
        color: '#7E22CE',
    },
    profileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    avatarGradient: {
        width: 24, // Matching web w-6 (24px)
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    headerUserName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
        maxWidth: 60,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    statusGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    statusValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669', // Green
    },
    statusValueBlack: {
        fontSize: 12,
        fontWeight: '500',
        color: '#1F2937',
    },
    dateText: {
        fontSize: 12,
        color: '#6B7280',
    },
    content: {
        flex: 1,
        marginBottom: 65, // Match nav height to prevent overlap
    },
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
        elevation: 8,
        height: 65, // Slightly taller for better touch targets
        zIndex: 1000, // Ensure it stays on top
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

    // Role Dropdown Styles
    roleDropdown: {
        position: 'absolute',
        top: 60,
        right: 16,
        width: 200,
        backgroundColor: 'white',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 100,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dropdownHeader: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    dropdownUserName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    dropdownUserRole: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    dropdownDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    roleOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    roleOptionActive: {
        backgroundColor: '#EFF6FF',
    },
    roleOptionText: {
        fontSize: 14,
        color: '#374151',
        marginLeft: 12,
    },
    // Logout button in dropdown removed since it's now in bottom nav
    // But keeping style in case needed or for partial reuse
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    logoutText: {
        fontSize: 14,
        color: '#EF4444',
        marginLeft: 12,
        fontWeight: '600',
    },
    backdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 90,
        backgroundColor: 'transparent',
    },
    toastContainer: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        zIndex: 9999,
        alignItems: 'center',
    },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 12,
        gap: 10,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    toastIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
    },
    toastText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
        flexShrink: 1,
    },
    toastCloseBtn: {
        padding: 4,
        marginLeft: 4,
    },
});

export default AdminPanelScreen;

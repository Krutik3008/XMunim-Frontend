import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../api';

const AdminTopBar = ({ title, onBack, stats: propStats, hideStatusBar }) => {
    const { user, switchRole } = useAuth();
    const navigation = useNavigation();
    const [stats, setStats] = React.useState(propStats || { total_users: 0 });
    const [showRoleDropdown, setShowRoleDropdown] = React.useState(false);

    React.useEffect(() => {
        if (!propStats) {
            fetchStats();
        }
    }, [propStats]);

    const fetchStats = async () => {
        try {
            const response = await adminAPI.getDashboard();
            setStats(response.data || response); // Handle case where response itself is the data
        } catch (error) {
            console.error('Error fetching stats in TopBar:', error);
        }
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
                console.error('Role switch failed', result.message);
                // Can't show toast easily without props, but could use Alert
            }
        }
    };

    return (
        <View style={styles.header}>
            <View style={styles.headerTop}>
                <View style={styles.headerTitleContainer}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#374151" />
                    </TouchableOpacity>
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
                    <View style={styles.statusItem}>
                        <Text style={styles.statusLabel}>Users: </Text>
                        <Text style={styles.statusValueBlack}>{stats.total_users || 0}</Text>
                    </View>
                </View>
                <Text style={styles.dateText}>
                    {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </Text>
            </View>

            {/* Role Dropdown */}
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
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        zIndex: 10,
        paddingBottom: 4,
        paddingTop: Platform.OS === 'android' ? 25 : 0,
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
        width: 24,
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
        color: '#059669',
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
    backdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 90,
        backgroundColor: 'transparent',
    },
});

export default AdminTopBar;

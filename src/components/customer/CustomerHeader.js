// Customer Header Component - Extracted from DashboardScreen
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../../api';

const CustomerHeader = ({ user, logout, showRoleDropdown, setShowRoleDropdown, handleRoleSwitch }) => {
    const [isAdminState, setIsAdminState] = useState(false);

    // Check global state first
    useEffect(() => {
        setIsAdminState(user?.admin_roles && user.admin_roles.length > 0);
    }, [user?.admin_roles]);

    const handleRoleDropdownToggle = async () => {
        const newValue = !showRoleDropdown;
        setShowRoleDropdown(newValue);

        // If opening the dropdown, do a quick check for admin status
        if (newValue) {
            try {
                const response = await authAPI.getMe();
                if (response.data) {
                    setIsAdminState(response.data.admin_roles && response.data.admin_roles.length > 0);
                }
            } catch (e) {
                console.log('Failed to check admin status:', e);
            }
        }
    };
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

    return (
        <View style={styles.header}>
            <View style={styles.headerTop}>
                <Text style={styles.logo}>ShopMunim</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        style={styles.roleSelector}
                        onPress={handleRoleDropdownToggle}
                    >
                        <Ionicons name="person" size={16} color="#3B82F6" />
                        <Text style={styles.roleSelectorText}>Customer</Text>
                        <Ionicons name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleLogout}>
                        <Text style={styles.headerLogout}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.headerBottom}>
                <Text style={styles.welcomeText}>Welcome, <Text style={styles.userName}>{user?.name || 'User'}</Text></Text>
                <View style={styles.phoneContainer}>
                    <Text style={styles.phoneText}>+91 {user?.phone}</Text>
                </View>
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
                        <TouchableOpacity
                            style={[styles.roleOption, user?.active_role === 'customer' && styles.roleOptionActive]}
                            onPress={() => handleRoleSwitch('customer')}
                        >
                            <Ionicons name="person" size={18} color="#3B82F6" />
                            <Text style={styles.roleOptionText}>Customer</Text>
                            {user?.active_role === 'customer' && (
                                <Ionicons name="checkmark" size={18} color="#3B82F6" />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.roleOption, user?.active_role === 'shop_owner' && styles.roleOptionActive]}
                            onPress={() => handleRoleSwitch('shop_owner')}
                        >
                            <Ionicons name="storefront" size={18} color="#8B5CF6" />
                            <Text style={styles.roleOptionText}>Shop Owner</Text>
                        </TouchableOpacity>
                        {isAdminState && (
                            <TouchableOpacity
                                style={[styles.roleOption, user?.active_role === 'admin' && styles.roleOptionActive]}
                                onPress={() => handleRoleSwitch('admin')}
                            >
                                <Ionicons name="shield" size={18} color="#F59E0B" />
                                <Text style={styles.roleOptionText}>Admin</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    // Header
    header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E5', zIndex: 100 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logo: { fontSize: 20, fontWeight: 'bold', color: '#3B82F6' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    roleSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5, gap: 6 },
    roleSelectorText: { fontSize: 14, color: '#333' },
    headerLogout: { fontSize: 14, color: '#666' },
    headerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    welcomeText: { fontSize: 14, color: '#666' },
    userName: { fontWeight: 'bold', color: '#333' },
    phoneContainer: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
    phoneText: { fontSize: 12, color: '#000' },

    // Role Dropdown
    roleDropdown: { position: 'absolute', top: 45, right: 60, backgroundColor: '#fff', borderRadius: 8, elevation: 10, padding: 8, zIndex: 1000, minWidth: 160 },
    roleOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
    roleOptionActive: { backgroundColor: '#F0F9FF', borderRadius: 6 },
    roleOptionText: { flex: 1, fontSize: 14, color: '#333' },
    backdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 990,
        backgroundColor: 'transparent',
    },
});

export default CustomerHeader;

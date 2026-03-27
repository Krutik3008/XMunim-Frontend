import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    Switch,
    RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI, getAPIErrorMessage } from '../../api';

const AdminRoleManagement = ({ showToast }) => {
    const [users, setUsers] = useState([]);
    const [currentUserRoles, setCurrentUserRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [showTestUsers, setShowTestUsers] = useState(false);

    // Role Management Modal
    const [selectedUser, setSelectedUser] = useState(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [updatingRole, setUpdatingRole] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getUsersForRoleAssignment();
            setUsers(response.data.users);
            setCurrentUserRoles(response.data.current_user_roles);
        } catch (err) {
            if (showToast) {
                showToast(getAPIErrorMessage(err), 'error');
            } else {
                Alert.alert('Error', getAPIErrorMessage(err));
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleAssignRole = async (userId, adminRoles, action) => {
        try {
            setUpdatingRole(true);
            await adminAPI.assignRole(userId, adminRoles, action);
            if (showToast) {
                showToast(`Role ${action}ed successfully`);
            } else {
                Alert.alert('Success', `Role ${action}ed successfully`);
            }
            await loadUsers(); // Reload to reflect changes
            setShowRoleModal(false);
        } catch (err) {
            if (showToast) {
                showToast(getAPIErrorMessage(err), 'error');
            } else {
                Alert.alert('Error', getAPIErrorMessage(err));
            }
        } finally {
            setUpdatingRole(false);
        }
    };

    const handlePromoteSuperAdmin = async (userId) => {
        Alert.alert(
            'Confirm Promotion',
            'Are you sure you want to promote this user to Super Admin? This action cannot be easily undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Promote',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setUpdatingRole(true);
                            await adminAPI.promoteToSuperAdmin(userId);
                            if (showToast) {
                                showToast('User promoted to Super Admin');
                            } else {
                                Alert.alert('Success', 'User promoted to Super Admin');
                            }
                            await loadUsers();
                            setShowRoleModal(false);
                        } catch (err) {
                            if (showToast) {
                                showToast(getAPIErrorMessage(err), 'error');
                            } else {
                                Alert.alert('Error', getAPIErrorMessage(err));
                            }
                        } finally {
                            setUpdatingRole(false);
                        }
                    }
                }
            ]
        );
    };

    const filterUsers = () => {
        return users.filter(user => {
            // Filter test users if toggle is off
            if (!showTestUsers) {
                const isTestUser =
                    (user.name.toLowerCase() === 'user' && user.admin_roles.length === 0) ||
                    (user.name.toLowerCase().includes('test') && user.admin_roles.length === 0) ||
                    user.name.toLowerCase().includes('debug') ||
                    user.name.toLowerCase().includes('demo');
                if (isTestUser) return false;
            }

            if (!search.trim()) return true;
            return (
                user.name.toLowerCase().includes(search.toLowerCase()) ||
                user.phone.includes(search)
            );
        });
    };

    const getRoleBadgeStyle = (adminRoles) => {
        if (adminRoles.includes('super_admin')) return { bg: '#FDE047', text: '#854D0E', icon: 'ribbon' };
        if (adminRoles.includes('admin')) return { bg: '#DBEAFE', text: '#1E40AF', icon: 'shield-checkmark' };
        return { bg: '#F3F4F6', text: '#4B5563', icon: 'person' };
    };

    const canManageUser = (targetUserRoles) => {
        const isSuperAdmin = currentUserRoles.includes('super_admin');
        const isAdmin = currentUserRoles.includes('admin');

        // Both Super Admin and Admin can see the Manage button
        return isSuperAdmin || isAdmin;
    };

    const renderUserItem = ({ item }) => {
        const roleStyle = getRoleBadgeStyle(item.admin_roles);
        const canManage = canManageUser(item.admin_roles);

        return (
            <View style={styles.userCard}>
                {/* Top Row: Avatar + Name + Manage Button */}
                <View style={styles.cardTopRow}>
                    <View style={[styles.avatar, { backgroundColor: roleStyle.bg }]}>
                        <Ionicons name={roleStyle.icon} size={22} color={roleStyle.text} />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{item.name}</Text>
                        <Text style={styles.userPhone}>+91 {item.phone}</Text>
                    </View>
                    {canManage && (
                        <TouchableOpacity
                            style={styles.manageButton}
                            onPress={() => {
                                setSelectedUser(item);
                                setShowRoleModal(true);
                            }}
                        >
                            <Ionicons name="settings-outline" size={14} color="#2563EB" />
                            <Text style={styles.manageButtonText}>Manage</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bottom Row: Role Badges */}
                <View style={styles.rolesRow}>
                    {item.admin_roles.includes('admin') && (
                        <View style={[styles.roleTag, { backgroundColor: '#2563EB' }]}>
                            <Ionicons name="shield-checkmark" size={12} color="#fff" />
                            <Text style={[styles.roleTagText, { color: '#fff' }]}>Admin</Text>
                        </View>
                    )}
                    {item.admin_roles.includes('super_admin') && (
                        <View style={[styles.roleTag, { backgroundColor: '#D97706' }]}>
                            <Ionicons name="ribbon" size={12} color="#fff" />
                            <Text style={[styles.roleTagText, { color: '#fff' }]}>Super Admin</Text>
                        </View>
                    )}
                    {(item.has_shop || item.active_role === 'shop_owner') && (
                        <View style={[styles.roleTag, { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }]}>
                            <Ionicons name="storefront" size={12} color="#16A34A" />
                            <Text style={[styles.roleTagText, { color: '#16A34A' }]}>Shop Owner</Text>
                        </View>
                    )}
                    <View style={[styles.roleTag, { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' }]}>
                        <Ionicons name="cart" size={12} color="#EA580C" />
                        <Text style={[styles.roleTagText, { color: '#EA580C' }]}>Customer</Text>
                    </View>
                    {item.verified && (
                        <View style={[styles.roleTag, { backgroundColor: '#16A34A' }]}>
                            <Ionicons name="checkmark-circle" size={12} color="#fff" />
                            <Text style={[styles.roleTagText, { color: '#fff' }]}>Verified</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const filteredUsers = filterUsers();

    const onRefresh = () => {
        setRefreshing(true);
        loadUsers();
    };

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={{ paddingBottom: 30 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header Text - Matches Web Style */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Role Management</Text>
                    <Text style={styles.headerSubtitle}>Manage user roles and permissions</Text>
                </View>

                {/* Search and Filters in a White Card */}
                <View style={styles.searchCard}>
                    <View style={[styles.searchContainer, { marginBottom: 12 }]}>
                        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or number..."
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Show Test Users</Text>
                        <Switch
                            value={showTestUsers}
                            onValueChange={setShowTestUsers}
                            trackColor={{ true: '#7C3AED', false: '#D1D5DB' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#7C3AED" />
                    </View>
                ) : (
                    <View style={styles.listContent}>
                        {filteredUsers.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No users found</Text>
                            </View>
                        ) : (
                            filteredUsers.map(item => (
                                <View key={item.id}>
                                    {renderUserItem({ item })}
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* Role Management Guidelines */}
                <View style={styles.guidelinesCard}>
                    <View style={styles.guidelinesHeader}>
                        <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
                        <Text style={styles.guidelinesTitle}>Role Management Guidelines:</Text>
                    </View>
                    <View style={styles.guidelineItem}>
                        <View style={[styles.guidelineDot, { backgroundColor: '#111827' }]} />
                        <Text style={styles.guidelineText}>
                            <Text style={styles.guidelineBold}>Super Admin:</Text> Can access admin panel, manage users, shops, and transactions
                        </Text>
                    </View>
                    <View style={styles.guidelineItem}>
                        <View style={[styles.guidelineDot, { backgroundColor: '#111827' }]} />
                        <Text style={styles.guidelineText}>
                            <Text style={styles.guidelineBold}>Admin:</Text> Can access admin panel, show users, shops, and transactions
                        </Text>
                    </View>
                    <View style={styles.guidelineItem}>
                        <View style={[styles.guidelineDot, { backgroundColor: '#111827' }]} />
                        <Text style={styles.guidelineText}>
                            Only Super Admins can promote other users to Admin
                        </Text>
                    </View>
                    <View style={styles.guidelineItem}>
                        <View style={[styles.guidelineDot, { backgroundColor: '#111827' }]} />
                        <Text style={styles.guidelineText}>
                            Users with admin roles can switch to admin mode using the role switcher
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Role Management Modal */}
            <Modal
                visible={showRoleModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowRoleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Manage Roles</Text>
                            <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        {selectedUser && (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.userSummary}>
                                    <Text style={styles.summaryName}>{selectedUser.name}</Text>
                                    <Text style={styles.summaryPhone}>+91 {selectedUser.phone}</Text>
                                    <Text style={styles.summaryRoles}>
                                        Current: {selectedUser.admin_roles.join(', ') || 'User'}
                                    </Text>
                                </View>

                                {/* Admin Action */}
                                <View style={styles.actionSection}>
                                    <View style={styles.actionHeader}>
                                        <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
                                        <Text style={styles.actionTitle}>Admin Access</Text>
                                    </View>
                                    <Text style={styles.actionDesc}>Can access admin panel and manage users/shops.</Text>

                                    {currentUserRoles.includes('super_admin') && (
                                        selectedUser.admin_roles.includes('admin') ? (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.buttonRed]}
                                                onPress={() => handleAssignRole(selectedUser.id, ['admin'], 'revoke')}
                                                disabled={updatingRole}
                                            >
                                                <Text style={styles.buttonTextWhite}>Revoke Admin Access</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.buttonBlue]}
                                                onPress={() => handleAssignRole(selectedUser.id, ['admin'], 'grant')}
                                                disabled={updatingRole}
                                            >
                                                <Text style={styles.buttonTextWhite}>Grant Admin Access</Text>
                                            </TouchableOpacity>
                                        )
                                    )}
                                    {!currentUserRoles.includes('super_admin') && (
                                        <View style={{ backgroundColor: '#FEF3C7', padding: 8, borderRadius: 4 }}>
                                            <Text style={{ fontSize: 12, color: '#92400E' }}>
                                                Only Super Admin can manage admin access.
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Super Admin Action (Only for Super Admins) */}
                                {currentUserRoles.includes('super_admin') && (
                                    <View style={[styles.actionSection, { marginTop: 16 }]}>
                                        <View style={styles.actionHeader}>
                                            <Ionicons name="ribbon" size={20} color="#D97706" />
                                            <Text style={styles.actionTitle}>Super Admin Access</Text>
                                        </View>
                                        <Text style={styles.actionDesc}>Full system access including role management.</Text>

                                        {selectedUser.admin_roles.includes('super_admin') ? (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.buttonRed]}
                                                onPress={() => handleAssignRole(selectedUser.id, ['super_admin'], 'revoke')}
                                                disabled={updatingRole}
                                            >
                                                <Text style={styles.buttonTextWhite}>Revoke Super Admin</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.buttonYellow]}
                                                onPress={() => handlePromoteSuperAdmin(selectedUser.id)}
                                                disabled={updatingRole}
                                            >
                                                <Text style={styles.buttonTextWhite}>Promote to Super Admin</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                {updatingRole && (
                                    <ActivityIndicator size="small" color="#7C3AED" style={{ marginTop: 20 }} />
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        padding: 16,
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#E5E7EB',
        marginTop: 2,
    },
    searchCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        padding: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    toggleLabel: {
        fontSize: 14,
        color: '#4B5563',
        fontWeight: '500',
    },
    listContent: {
        padding: 16,
    },
    userCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    userPhone: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 1,
    },
    rolesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    roleTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    roleTagText: {
        fontSize: 11,
        fontWeight: '600',
    },
    manageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    manageButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2563EB',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: { color: '#6B7280' },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        height: '60%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    modalBody: {
        padding: 16,
    },
    userSummary: {
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
    },
    summaryName: { fontSize: 16, fontWeight: 'bold' },
    summaryPhone: { fontSize: 14, color: '#4B5563' },
    summaryRoles: { fontSize: 12, color: '#6B7280', marginTop: 4 },
    actionSection: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
    },
    actionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    actionTitle: { fontSize: 14, fontWeight: '600' },
    actionDesc: { fontSize: 12, color: '#6B7280', marginBottom: 12 },
    actionButton: {
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonBlue: { backgroundColor: '#2563EB' },
    buttonRed: { backgroundColor: '#DC2626' },
    buttonYellow: { backgroundColor: '#D97706' },
    buttonTextWhite: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    // Guidelines Card
    guidelinesCard: {
        backgroundColor: '#EFF6FF',
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    guidelinesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    guidelinesTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    guidelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 10,
    },
    guidelineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 5,
    },
    guidelineText: {
        fontSize: 13,
        color: '#374151',
        flex: 1,
        lineHeight: 18,
    },
    guidelineBold: {
        fontWeight: '700',
        color: '#111827',
    },
});

export default AdminRoleManagement;

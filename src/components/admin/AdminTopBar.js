import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../api';

const AdminTopBar = ({ title, onBack, stats: propStats }) => {
    const { user } = useAuth();
    const [stats, setStats] = React.useState(propStats || { total_users: 0 });

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

                    <View style={styles.profileContainer}>
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
                    </View>
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
});

export default AdminTopBar;

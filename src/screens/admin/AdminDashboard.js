import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI, getAPIErrorMessage } from '../../api';
import { Skeleton } from '../../components/ui';

const { width } = Dimensions.get('window');

const AdminDashboard = ({ onRefreshStats, showToast }) => {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getDashboard();
            setDashboardData(response.data);
            if (onRefreshStats) onRefreshStats(response.data); // Update parent header with new data
            setError('');
        } catch (err) {
            if (showToast) {
                showToast(getAPIErrorMessage(err), 'error');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const formatCurrency = (amount) => {
        return `₹${parseFloat(amount || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    };

    if (loading && !refreshing && !dashboardData) {
        return (
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
            >
                <View style={styles.headerTextContainer}>
                    <Skeleton width="40%" height={28} style={{ marginBottom: 8 }} />
                    <Skeleton width="60%" height={16} />
                </View>

                <View style={styles.gridContainer}>
                    {[1, 2, 3, 4].map(i => (
                        <View key={i} style={styles.statCard}>
                            <View style={styles.statHeader}>
                                <Skeleton width="50%" height={12} />
                                <Skeleton width={32} height={32} borderRadius={8} />
                            </View>
                            <Skeleton width="70%" height={24} style={{ marginBottom: 4 }} />
                            <Skeleton width="40%" height={10} />
                        </View>
                    ))}
                </View>

                {[1, 2].map(i => (
                    <View key={i} style={styles.fullWidthCard}>
                        <View style={styles.cardHeader}>
                            <Skeleton width={20} height={20} borderRadius={10} />
                            <Skeleton width="40%" height={18} />
                        </View>
                        <Skeleton width="60%" height={12} style={{ marginBottom: 16 }} />
                        <View style={styles.row}>
                            <Skeleton width="30%" height={14} />
                            <Skeleton width="20%" height={14} />
                        </View>
                        <View style={styles.row}>
                            <Skeleton width="30%" height={14} />
                            <Skeleton width="30%" height={14} />
                        </View>
                    </View>
                ))}
            </ScrollView>
        );
    }

    // Stats Card Component
    const StatCard = ({ icon, title, value, subtext, color, iconBg }) => (
        <View style={styles.statCard}>
            <View style={styles.statHeader}>
                <Text style={styles.statTitle}>{title}</Text>
                <View style={[styles.statIconContainer, { backgroundColor: iconBg || '#F3F4F6' }]}>
                    <Ionicons name={icon} size={18} color={color || "#6B7280"} />
                </View>
            </View>
            <Text
                style={styles.statValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
            >
                {value}
            </Text>
            <Text style={styles.statSubtext}>{subtext}</Text>
        </View>
    );

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        >
            {/* Header Text (No Card) - Matches Web Mobile */}
            <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Dashboard</Text>
                <Text style={styles.headerSubtitle}>Overview of platform statistics</Text>
            </View>

            {/* Metrics Grid */}
            <View style={styles.gridContainer}>
                <StatCard
                    title="Users"
                    icon="people-outline"
                    value={dashboardData?.total_users || 0}
                    subtext={`+${dashboardData?.new_users_this_week || 0} this week`}
                    color="#7C3AED"
                    iconBg="#F3E8FF"
                />
                <StatCard
                    title="Shops"
                    icon="storefront-outline"
                    value={dashboardData?.total_shops || 0}
                    subtext={`${dashboardData?.active_shops || 0} active`}
                    color="#059669"
                    iconBg="#D1FAE5"
                />
                <StatCard
                    title="Members"
                    icon="people-outline"
                    value={dashboardData?.total_customers || 0}
                    subtext="All shops"
                    color="#2563EB"
                    iconBg="#EFF6FF"
                />
                <StatCard
                    title="₹ Amount"
                    icon="wallet-outline"
                    value={formatCurrency(dashboardData?.total_sales || 0)}
                    subtext="Total Sales"
                    color="#10B981"
                    iconBg="#ECFDF5"
                />
            </View>

            {/* Daily Transactions Card */}
            <View style={styles.fullWidthCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="cart-outline" size={20} color="#1F2937" />
                    <Text style={styles.cardTitle}>Today's Transactions</Text>
                </View>
                <Text style={styles.cardDescription}>Transactions processed today</Text>

                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Count</Text>
                    <Text style={styles.rowValue}>{dashboardData?.daily_transactions?.count || 0}</Text>
                </View>
                <View style={[styles.row, styles.borderBottom]}>
                    <Text style={styles.rowLabel}>Amount</Text>
                    <Text style={[styles.rowValue, { color: '#2563EB' }]}>
                        {formatCurrency(dashboardData?.daily_transactions?.amount || 0)}
                    </Text>
                </View>
            </View>

            {/* Platform Activity Card */}
            <View style={styles.fullWidthCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="trending-up-outline" size={20} color="#1F2937" />
                    <Text style={styles.cardTitle}>Platform Activity</Text>
                </View>
                <Text style={styles.cardDescription}>Key platform metrics</Text>

                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Active Shops</Text>
                    <Text style={styles.rowValue}>{dashboardData?.active_shops || 0}</Text>
                </View>
                <View style={[styles.row, styles.borderBottom]}>
                    <Text style={styles.rowLabel}>New Users (7d)</Text>
                    <Text style={[styles.rowValue, { color: '#059669' }]}>
                        +{dashboardData?.new_users_this_week || 0}
                    </Text>
                </View>
            </View>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTextContainer: {
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#E5E7EB', // Gray-200
        marginTop: 4,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    statCard: {
        width: (width - 40) / 2, // 2 columns with spacing
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center', // Center vertically
        marginBottom: 8,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 2,
    },
    statSubtext: {
        fontSize: 10,
        color: '#9CA3AF',
    },
    fullWidthCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    cardDescription: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    borderBottom: {
        borderBottomWidth: 0, // Last item usually no border or handled by container
    },
    rowLabel: {
        fontSize: 14,
        color: '#4B5563',
    },
    rowValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
});

export default AdminDashboard;

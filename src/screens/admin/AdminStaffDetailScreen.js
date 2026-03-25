import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Dimensions,
    RefreshControl,
    Platform,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { staffAPI, shopAPI, getAPIErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import AdminBottomTab from '../../components/admin/AdminBottomTab';

const { width } = Dimensions.get('window');

const AdminStaffDetailScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { customer: initialCustomer, shopId } = route.params;

    const [customer, setCustomer] = useState(initialCustomer);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [shopDetails, setShopDetails] = useState(null);
    const { logout } = useAuth();

    // Activity Logs / Earnings state
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [serviceRate, setServiceRate] = useState(initialCustomer?.service_rate?.toString() || '0');
    const [serviceRateType, setServiceRateType] = useState(initialCustomer?.service_rate_type || 'daily');
    const [serviceLog, setServiceLog] = useState(initialCustomer?.service_log || {});
    const [calculatedTotal, setCalculatedTotal] = useState(0);
    const [totalHoursInMonth, setTotalHoursInMonth] = useState(0);

    useEffect(() => {
        loadData();
    }, [initialCustomer?.id, shopId]);

    useEffect(() => {
        calculateTotal();
    }, [serviceLog, serviceRate, serviceRateType, currentMonth]);

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const response = await staffAPI.getById(shopId, initialCustomer.id);
            const updatedMember = response.data;
            if (updatedMember) {
                setCustomer(updatedMember);
                setServiceRate(updatedMember.service_rate?.toString() || '0');
                setServiceRateType(updatedMember.service_rate_type || 'daily');
                setServiceLog(updatedMember.service_log || {});
            }

            const shopRes = await shopAPI.getDashboard(shopId);
            setShopDetails(shopRes.data?.shop);
        } catch (error) {
            console.error('Failed to load admin staff details:', error);
        } finally {
            if (showLoading) setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateDayTotal = (entry) => {
        if (!entry || typeof entry !== 'object') return 0;
        const entryRateType = entry.rate_type || (entry.hours > 0 ? 'hourly' : 'daily');

        if (entryRateType === 'hourly') {
            if (entry.hours_log && Array.isArray(entry.hours_log) && entry.hours_log.length > 0) {
                return entry.hours_log.reduce((sum, log) => sum + (log.hours * log.rate), 0);
            }
            return (entry.hours || 0) * (entry.rate || 0);
        } else {
            return entry.rate || 0;
        }
    };

    const calculateTotal = () => {
        const rate = parseFloat(serviceRate) || 0;
        const year = currentMonth.getFullYear();
        const monthNum = currentMonth.getMonth();
        const monthStr = (monthNum + 1).toString().padStart(2, '0');
        const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
        const monthPrefix = `${year}-${monthStr}`;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let total = 0;
        let totalHrs = 0;

        if (serviceRateType === 'monthly') {
            let absentCount = 0;
            Object.keys(serviceLog).forEach(dateStr => {
                const entry = serviceLog[dateStr];
                const status = (typeof entry === 'object' ? entry.status : entry);
                if (dateStr.startsWith(monthPrefix) && status === 'absent') {
                    absentCount++;
                }
            });
            const dailyRate = rate / daysInMonth;
            total = Math.max(0, rate - (absentCount * dailyRate));
        } else {
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
                const entry = serviceLog[dateStr];
                const status = entry ? (typeof entry === 'object' ? entry.status : entry) : null;

                if (status === 'present') {
                    if (typeof entry === 'object' && entry !== null) {
                        total += calculateDayTotal(entry);
                        const dayRateType = entry.rate_type || (entry.hours > 0 ? 'hourly' : 'daily');
                        if (dayRateType === 'hourly') {
                            totalHrs += (entry.hours || 0);
                        }
                    } else {
                        // Legacy string
                        total += rate;
                    }
                }
            }
        }
        setCalculatedTotal(total);
        setTotalHoursInMonth(totalHrs);
    };

    const changeMonth = (offset) => {
        const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
        setCurrentMonth(newMonth);
    };

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const padDays = Array(firstDay).fill(null);
        const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const grid = [...padDays, ...monthDays];

        return (
            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <Ionicons name="calendar-outline" size={20} color="#111827" />
                    <Text style={styles.cardTitle}>Staff Log & Earnings</Text>
                </View>

                <View style={styles.calendarHeaderRow}>
                    <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNavBtn}>
                        <Ionicons name="chevron-back" size={20} color="#374151" />
                    </TouchableOpacity>
                    <Text style={styles.monthLabel}>
                        {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNavBtn}>
                        <Ionicons name="chevron-forward" size={20} color="#374151" />
                    </TouchableOpacity>
                </View>

                <View style={styles.weekDaysRow}>
                    {weekDays.map((day, idx) => (
                        <Text key={idx} style={styles.weekDayText}>{day}</Text>
                    ))}
                </View>

                <View style={styles.daysGrid}>
                    {grid.map((day, idx) => {
                        if (day === null) return <View key={`pad-${idx}`} style={styles.dayCell} />;

                        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                        const entry = serviceLog[dateStr];
                        const status = entry ? (typeof entry === 'object' ? entry.status : entry) : null;
                        const hours = (typeof entry === 'object' ? entry.hours : 0);

                        let cellBg = '#F9FAFB';
                        let cellBorder = '#E5E7EB';
                        if (status === 'present') {
                            cellBg = '#D1FAE5';
                            cellBorder = '#10B981';
                        } else if (status === 'absent') {
                            cellBg = '#FEE2E2';
                            cellBorder = '#EF4444';
                        }

                        return (
                            <View key={dateStr} style={[styles.dayCell, { backgroundColor: cellBg, borderColor: cellBorder }]}>
                                <Text style={styles.dayText}>{day}</Text>
                                <View style={styles.statusIndicator}>
                                    {status === 'present' && hours > 0 ? (
                                        <Text style={{ fontSize: 9, color: '#059669', fontWeight: '700' }}>{hours}h</Text>
                                    ) : status === 'present' ? (
                                        <Ionicons name="checkmark" size={12} color="#059669" />
                                    ) : status === 'absent' ? (
                                        <Ionicons name="close" size={12} color="#DC2626" />
                                    ) : null}
                                </View>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Estimated Monthly Earnings:</Text>
                    <Text style={styles.totalValue}>₹{calculatedTotal.toFixed(0)}</Text>
                    <Text style={styles.totalSubtext}>
                        {serviceRateType === 'hourly' ? `${totalHoursInMonth} hours at ₹${serviceRate}/hr` :
                            serviceRateType === 'monthly' ? `Monthly Fixed: ₹${serviceRate}` : `Daily Rate: ₹${serviceRate}`}
                    </Text>
                </View>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <LinearGradient colors={['#4c1d95', '#1e40af']} style={styles.container}>
                <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={{ color: '#fff', marginTop: 12 }}>Loading Staff Details...</Text>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#4c1d95', '#1e40af']} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Staff logs for {customer?.name}</Text>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(false)} tintColor="#fff" />}
                >
                    {/* Shop Information Card */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Ionicons name="storefront-outline" size={20} color="#111827" />
                            <Text style={styles.cardTitle}>Shop Information</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Name:</Text>
                            <Text style={styles.value}>{shopDetails?.name || 'Loading...'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Category:</Text>
                            <Text style={styles.value}>{shopDetails?.category || 'General'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Location:</Text>
                            <Text style={styles.value}>{shopDetails?.location || 'Unknown'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Code:</Text>
                            <View style={styles.codeBadge}>
                                <Text style={styles.codeText}>
                                    {shopDetails?.shop_code || 'N/A'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Member Info Card */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Ionicons name="person-outline" size={20} color="#111827" />
                            <Text style={styles.cardTitle}>Staff Information</Text>
                        </View>

                        <View style={styles.profileSection}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{customer?.name?.charAt(0).toUpperCase()}</Text>
                                <View style={styles.statusDot} />
                            </View>
                            <View style={styles.profileDetails}>
                                <Text style={styles.customerNameMain}>{customer?.name}</Text>
                                <Text style={styles.customerPhone}>+91 {customer?.phone}</Text>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>STAFF</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.statsGrid}>
                        <View style={[styles.statBox, { backgroundColor: '#F3E8FF' }]}>
                            <Text style={[styles.statValue, { color: '#7C3AED' }]}>{serviceRateType.toUpperCase()}</Text>
                            <Text style={styles.statLabel}>Rate Type</Text>
                        </View>
                        <View style={[styles.statBox, { backgroundColor: '#EFF6FF' }]}>
                            <Text style={[styles.statValue, { color: '#2563EB' }]}>₹{serviceRate}</Text>
                            <Text style={styles.statLabel}>Current Rate</Text>
                        </View>
                    </View>

                    {renderCalendar()}


                </ScrollView>
            </SafeAreaView>

            <AdminBottomTab 
                activeView="customers" // Since it's reached from the Members tab
                onTabPress={(screen) => navigation.navigate('AdminPanel', { screen })}
                onLogout={logout}
            />
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        marginBottom: 10,
    },
    backButton: {
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 0.5,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    label: {
        fontSize: 14,
        color: '#111827',
        width: 100,
        fontWeight: 'bold',
    },
    value: {
        fontSize: 14,
        color: '#111827',
        flex: 1,
    },
    codeBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    codeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#374151',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0284C7',
    },
    statusDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: '#fff',
    },
    profileDetails: {
        flex: 1,
    },
    customerNameMain: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    customerPhone: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    badge: {
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 6,
    },
    badgeText: {
        color: '#0EA5E9',
        fontSize: 10,
        fontWeight: 'bold',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    statBox: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: '#4B5563',
        marginTop: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    calendarHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    monthNavBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    monthLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    weekDaysRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    weekDayText: {
        width: width / 8.5,
        textAlign: 'center',
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    dayCell: {
        width: (width - 84) / 7,
        height: 50,
        margin: 1,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
    },
    statusIndicator: {
        height: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalBox: {
        marginTop: 20,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        alignItems: 'flex-start',
    },
    totalLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 4,
    },
    totalValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    totalSubtext: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 4,
    },
    metaCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    metaLabel: {
        fontSize: 13,
        color: '#6B7280',
    },
    metaValue: {
        fontSize: 13,
        color: '#111827',
        fontWeight: '500',
    },
    whatsappBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F0FDF4',
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 8,
    },
    whatsappText: {
        color: '#16A34A',
        fontWeight: '600',
        fontSize: 14,
    }
});

export default AdminStaffDetailScreen;

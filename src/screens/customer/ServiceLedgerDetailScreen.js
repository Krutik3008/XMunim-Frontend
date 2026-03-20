import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Dimensions,
    Platform,
    RefreshControl,
    Linking,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import CustomerHeader from '../../components/customer/CustomerHeader';
import { colors } from '../../theme';
import { customerDashboardAPI } from '../../api';

const ServiceLedgerDetailScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout, switchRole } = useAuth();
    const { customer, shopId, shopDetails } = route.params;

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [serviceLog, setServiceLog] = useState(customer?.service_log || {});
    const [calculatedTotal, setCalculatedTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const response = await customerDashboardAPI.getLedger();
            const ledger = response.data || [];
            // Find the current service in the ledger
            const updatedItem = ledger.find(item => item.customer?.id === (customer?.id || route.params.customer?.id));
            if (updatedItem && updatedItem.customer) {
                setServiceLog(updatedItem.customer.service_log || {});
            }
        } catch (error) {
            console.log('Failed to refresh data:', error);
        } finally {
            if (showLoading) setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData(false);
    }, []);

    useEffect(() => {
        calculateTotal();
    }, [serviceLog, customer?.service_rate, customer?.service_rate_type, currentMonth]);

    const getDateStatus = (dateStr) => {
        const entry = serviceLog[dateStr];
        if (!entry) return null;
        if (typeof entry === 'object' && entry !== null) {
            return entry.status;
        }
        return entry; // Legacy string
    };

    const calculateTotal = () => {
        const savedRate = customer?.service_rate;
        const savedRateType = customer?.service_rate_type;

        if (savedRate === undefined || savedRate === null || isNaN(parseFloat(savedRate))) {
            setCalculatedTotal(0);
            return;
        }

        const globalRate = parseFloat(savedRate);
        const year = currentMonth.getFullYear();
        const monthNum = currentMonth.getMonth();
        const monthStr = (monthNum + 1).toString().padStart(2, '0');
        const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
        const monthPrefix = `${year}-${monthStr}`;

        if (savedRateType === 'monthly') {
            // Monthly: Start with full rate, subtract for explicit "absent" markings
            let absentCount = 0;
            Object.keys(serviceLog).forEach(dateStr => {
                if (dateStr.startsWith(monthPrefix) && getDateStatus(dateStr) === 'absent') {
                    absentCount++;
                }
            });
            
            const dailyRate = globalRate / daysInMonth;
            const reduction = absentCount * dailyRate;
            setCalculatedTotal(Math.max(0, globalRate - reduction));
        } else {
            // Daily/Hourly: Incremental total based on "present" (implicit or explicit)
            let total = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
                const status = getDateStatus(dateStr);
                
                if (status === 'present') {
                    // Try to use stored rate if available, else fallback to current customer.service_rate
                    const entry = serviceLog[dateStr];
                    const storedRate = (typeof entry === 'object' && entry !== null && entry.rate !== undefined) 
                        ? entry.rate 
                        : globalRate; 
                    total += storedRate;
                }
            }
            setCalculatedTotal(total);
        }
    };

    const changeMonth = (offset) => {
        const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
        setCurrentMonth(newMonth);
    };

    const handleRoleSwitch = async (role) => {
        setShowRoleDropdown(false);
        if (role !== user?.active_role) {
            const success = await switchRole(role);
            if (success) {
                const message = `Role switched to ${role === 'shop_owner' ? 'Business Owner' : 'Admin'}`;
                if (role === 'shop_owner') {
                    navigation.reset({ index: 0, routes: [{ name: 'ShopOwnerDashboard', params: { successMessage: message } }] });
                } else if (role === 'admin') {
                    navigation.reset({ index: 0, routes: [{ name: 'AdminPanel', params: { successMessage: message } }] });
                }
            }
        }
    };

    const handlePayNow = async () => {
        const upiId = shopDetails?.upi_id;
        const shopName = shopDetails?.name || 'Shop';
        const amount = calculatedTotal.toFixed(2);

        if (!upiId) {
            Alert.alert(
                'UPI ID Not Found', 
                'This business has not set up their UPI ID yet. Please contact the owner to make a payment.'
            );
            return;
        }

        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Payment for ${customer?.name || 'Service'}`)}`;

        try {
            const supported = await Linking.canOpenURL(upiUrl);
            if (supported) {
                await Linking.openURL(upiUrl);
            } else {
                Alert.alert(
                    'No UPI App Found', 
                    'Could not find any UPI apps (PhonePe, GPay, Paytm, etc.) on this device.'
                );
            }
        } catch (error) {
            console.error('UPI payment error:', error);
            Alert.alert('Error', 'Failed to open UPI app. Please try again later.');
        }
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
            <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
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
                        if (day === null) {
                            return <View key={`pad-${idx}`} style={styles.dayCell} />;
                        }

                        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                        const status = getDateStatus(dateStr);
                        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                        let cellBg = '#F9FAFB';
                        let cellBorder = '#E5E7EB';
                        if (status === 'present') {
                            cellBg = '#D1FAE5';
                            cellBorder = '#10B981';
                        } else if (status === 'absent') {
                            cellBg = '#FEE2E2';
                            cellBorder = '#EF4444';
                        }
                        if (isToday && !status) {
                            cellBg = '#EFF6FF';
                            cellBorder = '#3B82F6';
                        }

                        return (
                            <View
                                key={dateStr}
                                style={[styles.dayCell, { backgroundColor: cellBg, borderColor: cellBorder }]}
                            >
                                <Text style={styles.dayText}>{day}</Text>
                                <View style={styles.statusIndicator}>
                                    {status === 'present' && <Ionicons name="checkmark" size={14} color="#059669" />}
                                    {status === 'absent' && <Ionicons name="close" size={14} color="#DC2626" />}
                                </View>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.totalCalculationBox}>
                    <Text style={styles.totalCalculationLabel}>Calculated amount for this month:</Text>
                    <View style={styles.calculationRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.totalCalculationValue}>₹{calculatedTotal.toFixed(2)}</Text>
                            <Text style={styles.rateInfoText}>
                                Rate: ₹{customer?.service_rate || 0} / {customer?.service_rate_type || 'day'}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.payButton}
                            onPress={handlePayNow}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#2563EB', '#1D4ED8']}
                                style={styles.payButtonGradient}
                            >
                                <Ionicons name="card-outline" size={18} color="#fff" />
                                <Text style={styles.payButtonText}>Pay Now</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <CustomerHeader
                    user={user}
                    logout={logout}
                    showRoleDropdown={showRoleDropdown}
                    setShowRoleDropdown={setShowRoleDropdown}
                    handleRoleSwitch={handleRoleSwitch}
                />
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadData(false)} />
                    }
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#2563EB" />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.headerTitle}>{customer?.name || 'Service Details'}</Text>
                            <Text style={styles.headerSubtitle}>{shopDetails?.name || 'Shop Details'}</Text>
                        </View>
                    </View>

                    {/* Shop Info Card */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Ionicons name="storefront-outline" size={20} color="#111827" />
                            <Text style={styles.cardTitle}>Business Information</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Name:</Text>
                            <Text style={styles.value}>{shopDetails?.name || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Location:</Text>
                            <Text style={styles.value}>{shopDetails?.location || 'N/A'}</Text>
                        </View>
                    </View>

                    {/* Service Info Card */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Ionicons name="calendar-outline" size={20} color="#111827" />
                            <Text style={styles.cardTitle}>Attendance Tracking</Text>
                        </View>
                        <View style={{ marginBottom: 16 }}>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Type:</Text>
                                <Text style={[styles.value, { textTransform: 'capitalize' }]}>{customer?.role || customer?.category || (customer?.type === 'services' ? 'Service' : customer?.type) || 'Service'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Rate Type:</Text>
                                <Text style={[styles.value, { textTransform: 'capitalize' }]}>{customer?.service_rate_type || 'Daily'}</Text>
                            </View>
                        </View>
                        {renderCalendar()}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: { 
        marginRight: 10, 
        marginLeft: -10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 8,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        color: '#6B7280',
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    calendarContainer: {},
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    monthNavBtn: {
        padding: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    monthLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    weekDaysRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    weekDayText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        borderWidth: 0.5,
        borderColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    dayText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1A1A1A',
    },
    statusIndicator: {
        height: 16,
        marginTop: 2,
    },
    totalCalculationBox: {
        marginTop: 20,
        backgroundColor: '#EFF6FF',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    totalCalculationLabel: {
        fontSize: 13,
        color: '#3B82F6',
        fontWeight: '600',
        marginBottom: 4,
    },
    totalCalculationValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1A1A1A',
    },
    rateInfoText: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
        fontStyle: 'italic',
    },
    calculationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    payButton: {
        marginLeft: 12,
        borderRadius: 10,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    payButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    payButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 6,
    },
});

export default ServiceLedgerDetailScreen;

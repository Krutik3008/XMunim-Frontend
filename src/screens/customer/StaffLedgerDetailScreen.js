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
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import CustomerHeader from '../../components/customer/CustomerHeader';
import { colors } from '../../theme';

const StaffLedgerDetailScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout, switchRole } = useAuth();
    const { customer: staff, shopId, shopDetails } = route.params;

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [serviceLog, setServiceLog] = useState(staff?.service_log || {});
    const [calculatedTotal, setCalculatedTotal] = useState(0);
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);

    useEffect(() => {
        calculateTotal();
    }, [serviceLog, staff?.service_rate, staff?.service_rate_type, currentMonth]);

    const calculateTotal = () => {
        const rate = parseFloat(staff?.service_rate || 0);
        if (isNaN(rate)) {
            setCalculatedTotal(0);
            return;
        }

        const year = currentMonth.getFullYear();
        const month = (currentMonth.getMonth() + 1).toString().padStart(2, '0');
        const monthPrefix = `${year}-${month}`;

        let presentCount = 0;
        Object.keys(serviceLog).forEach(dateStr => {
            if (dateStr.startsWith(monthPrefix) && serviceLog[dateStr] === 'present') {
                presentCount++;
            }
        });

        if (staff?.service_rate_type === 'daily' || staff?.service_rate_type === 'hourly') {
            setCalculatedTotal(presentCount * rate);
        } else {
            setCalculatedTotal(rate); // Monthly rate is fixed
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
                        const status = serviceLog[dateStr];
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
                    <Text style={styles.totalCalculationLabel}>Calculated salary for this month:</Text>
                    <Text style={styles.totalCalculationValue}>₹{calculatedTotal.toFixed(2)}</Text>
                    <Text style={styles.rateInfoText}>
                        Rate: ₹{staff?.service_rate || 0} / {staff?.service_rate_type || 'day'}
                    </Text>
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
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#2563EB" />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.headerTitle}>{staff?.name || 'Staff Details'}</Text>
                            <Text style={styles.headerSubtitle}>{shopDetails?.name || 'Business Details'}</Text>
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

                    {/* Staff Info Card */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Ionicons name="briefcase-outline" size={20} color="#111827" />
                            <Text style={styles.cardTitle}>Staff Attendance & Salary</Text>
                        </View>
                        <View style={{ marginBottom: 16 }}>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Type:</Text>
                                <Text style={[styles.value, { textTransform: 'capitalize' }]}>{staff?.role || 'Staff'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Rate Type:</Text>
                                <Text style={[styles.value, { textTransform: 'capitalize' }]}>{staff?.service_rate_type || 'Daily'}</Text>
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
});

export default StaffLedgerDetailScreen;

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
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
    ToastAndroid
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import CustomerHeader from '../../components/customer/CustomerHeader';
import CustomerBottomNav from '../../components/customer/CustomerBottomNav';
import { colors } from '../../theme';
import { customerDashboardAPI } from '../../api';

const StaffLedgerDetailScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout, switchRole } = useAuth();
    const { customer: initialStaff, shopId, shopDetails } = route.params;

    const [staff, setStaff] = useState(initialStaff);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [serviceLog, setServiceLog] = useState(initialStaff?.service_log || {});
    const [calculatedTotal, setCalculatedTotal] = useState(0);
    const [totalHoursInMonth, setTotalHoursInMonth] = useState(0);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [showPaymentRequestModal, setShowPaymentRequestModal] = useState(false);
    const [requestType, setRequestType] = useState('Salary Payment');
    const [reminderMessage, setReminderMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showRequestTypeDropdown, setShowRequestTypeDropdown] = useState(false);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [toastType, setToastType] = useState('success');
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef(null);

    const showToast = (message, type = 'success') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        
        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);
        Animated.spring(toastAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 40
        }).start();

        toastTimer.current = setTimeout(() => {
            Animated.timing(toastAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setToastVisible(false));
        }, 3000);
    };

    const renderToast = () => {
        if (!toastVisible) return null;

        return (
            <Animated.View 
                style={[
                    styles.toastContainer, 
                    { 
                        opacity: toastAnim,
                        transform: [{ 
                            translateY: toastAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0]
                            })
                        }] 
                    }
                ]}
            >
                <View style={styles.toastContent}>
                    <View style={[styles.toastIcon, { backgroundColor: toastType === 'error' ? '#EF4444' : '#10B981' }]}>
                        <Ionicons name={toastType === 'error' ? "alert-circle" : "checkmark-circle"} size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </View>
            </Animated.View>
        );
    };

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const response = await customerDashboardAPI.getLedger();
            const ledger = response.data || [];
            // Find the current staff in the ledger
            const updatedItem = ledger.find(item => item.customer?.id === (initialStaff?.id || route.params.customer?.id));
            if (updatedItem && updatedItem.customer) {
                setStaff(updatedItem.customer);
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
    }, [serviceLog, staff?.service_rate, staff?.service_rate_type, currentMonth]);

    const getDateStatus = (dateStr) => {
        const entry = serviceLog[dateStr];
        if (!entry) return null;
        if (typeof entry === 'object' && entry !== null) {
            return entry.status;
        }
        return entry; // Legacy string
    };

    const getDateHours = (dateStr) => {
        const entry = serviceLog[dateStr];
        if (!entry || typeof entry !== 'object') return 0;
        return entry.hours || 0;
    };

    const calculateDayTotal = (entry) => {
        if (!entry || typeof entry !== 'object') return 0;
        if (entry.hours_log && Array.isArray(entry.hours_log) && entry.hours_log.length > 0) {
            return entry.hours_log.reduce((sum, log) => sum + (log.hours * log.rate), 0);
        }
        return (entry.hours || 1) * (entry.rate || 0);
    };

    const calculateTotal = () => {
        const savedRate = staff?.service_rate;
        const savedRateType = staff?.service_rate_type;

        if (savedRate === undefined || savedRate === null || isNaN(parseFloat(savedRate))) {
            setCalculatedTotal(0);
            setTotalHoursInMonth(0);
            return;
        }

        const globalRate = parseFloat(savedRate);
        const year = currentMonth.getFullYear();
        const monthNum = currentMonth.getMonth();
        const monthStr = (monthNum + 1).toString().padStart(2, '0');
        const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
        const monthPrefix = `${year}-${monthStr}`;

        if (savedRateType === 'monthly') {
            let absentCount = 0;
            Object.keys(serviceLog).forEach(dateStr => {
                if (dateStr.startsWith(monthPrefix) && getDateStatus(dateStr) === 'absent') {
                    absentCount++;
                }
            });

            const dailyRate = globalRate / daysInMonth;
            const reduction = absentCount * dailyRate;
            setCalculatedTotal(Math.max(0, globalRate - reduction));
            setTotalHoursInMonth(0);
        } else if (savedRateType === 'hourly') {
            let total = 0;
            let totalHrs = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
                const status = getDateStatus(dateStr);

                if (status === 'present') {
                    const entry = serviceLog[dateStr];
                    if (typeof entry === 'object' && entry !== null) {
                        total += calculateDayTotal(entry);
                        totalHrs += (entry.hours || 0);
                    }
                }
            }
            setCalculatedTotal(total);
            setTotalHoursInMonth(totalHrs);
        } else {
            // Daily: Incremental total based on "present" (implicit or explicit)
            let total = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
                const status = getDateStatus(dateStr);

                if (status === 'present') {
                    const entry = serviceLog[dateStr];
                    const storedRate = (typeof entry === 'object' && entry !== null && entry.rate !== undefined)
                        ? entry.rate
                        : globalRate;
                    total += storedRate;
                }
            }
            setCalculatedTotal(total);
            setTotalHoursInMonth(0);
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

    const handleSendPaymentRequest = async () => {
        if (!staff?.phone) {
            Alert.alert('Error', 'Staff phone number not found.');
            return;
        }

        const amount = calculatedTotal.toFixed(2);
        const shopName = shopDetails?.name || 'Our Shop';
        const staffName = staff?.name || 'Staff';
        const monthName = currentMonth.toLocaleString('default', { month: 'long' });

        let messageBody = '';
        let title = 'Payment Request';

        if (requestType === 'Salary Payment') {
            title = 'Salary Payment Request';
            messageBody = `Salary request for ${monthName} ${currentMonth.getFullYear()} - ₹${amount}`;
        } else if (requestType === 'Advance Payment') {
            title = 'Advance Payment Request';
            messageBody = `Advance request of ₹${amount} by ${staffName}`;
        } else {
            title = 'Bonus Payment Request';
            messageBody = `Bonus request for ${monthName} ${currentMonth.getFullYear()} - ₹${amount}`;
        }

        if (reminderMessage.trim()) {
            messageBody += `\nNote: ${reminderMessage}`;
        }

        setIsSending(true);
        try {
            await customerDashboardAPI.notifyOwner(shopId, {
                title: title,
                body: messageBody,
                method: "Push Notification"
            });
            setShowPaymentRequestModal(false);
            if (Platform.OS === 'android') {
                showToast('Payment request sent to shop owner.');
            } else {
                Alert.alert('Success', 'Payment request sent to shop owner.');
            }
        } catch (error) {
            const errorMessage = error.response?.data?.detail || 'Failed to send notification';
            setShowPaymentRequestModal(false);
            if (Platform.OS === 'android') {
                showToast(errorMessage, 'error');
            } else {
                Alert.alert('Error', errorMessage);
            }
        } finally {
            setIsSending(false);
        }
    };

    const handlePayNow = () => {
        const upiId = shopDetails?.upi_id;
        const shopName = shopDetails?.name || 'Shop';

        if (!upiId) {
            Alert.alert('Payment Error', 'This shop has not set up a UPI ID for payments yet.');
            return;
        }

        const amount = calculatedTotal.toFixed(2);
        const note = `Payment for ${staff?.name || 'Staff'} - ${currentMonth.toLocaleString('default', { month: 'long' })} ${currentMonth.getFullYear()}`;

        const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

        Linking.canOpenURL(upiUrl).then(supported => {
            if (supported) {
                Linking.openURL(upiUrl);
            } else {
                Alert.alert('Payment Error', 'No UPI app found. Please install a UPI app.');
            }
        }).catch(err => {
            console.error('An error occurred', err);
            Alert.alert('Payment Error', 'Could not open UPI app.');
        });
    };

    const renderPaymentRequestModal = () => (
        <Modal
            visible={showPaymentRequestModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowPaymentRequestModal(false)}
        >
            <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <TouchableWithoutFeedback onPress={() => { setShowRequestTypeDropdown(false); Keyboard.dismiss(); }}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="time-outline" size={22} color="#2563EB" />
                                <Text style={styles.modalTitle}>Payment Request</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowPaymentRequestModal(false)}>
                                <Ionicons name="close-circle-outline" size={26} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
                            <View style={styles.modalCard}>
                                <Text style={styles.modalCardLabel}>Staff Member</Text>
                                <Text style={styles.modalCardValue}>{staff?.name || 'N/A'}</Text>
                                <View style={{ height: 12 }} />
                                <Text style={styles.modalCardLabel}>Calculated Amount</Text>
                                <Text style={[styles.modalCardValue, { color: '#2563EB', fontSize: 20 }]}>₹{calculatedTotal.toFixed(2)}</Text>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Request Type</Text>
                                <TouchableOpacity
                                    style={styles.dropdownTrigger}
                                    onPress={() => setShowRequestTypeDropdown(!showRequestTypeDropdown)}
                                >
                                    <Text style={styles.dropdownValue}>{requestType}</Text>
                                    <Ionicons name={showRequestTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
                                </TouchableOpacity>

                                {showRequestTypeDropdown && (
                                    <View style={styles.dropdownMenu}>
                                        {['Salary Payment', 'Advance Payment', 'Bonus Payment'].map((type) => (
                                            <TouchableOpacity
                                                key={type}
                                                style={[styles.dropdownItem, requestType === type && styles.dropdownItemActive]}
                                                onPress={() => {
                                                    setRequestType(type);
                                                    setShowRequestTypeDropdown(false);
                                                }}
                                            >
                                                <Text style={[styles.dropdownItemText, requestType === type && styles.dropdownItemTextActive]}>{type}</Text>
                                                {requestType === type && <Ionicons name="checkmark" size={18} color="#2563EB" />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Extra Note (Optional)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Add a message for the staff member..."
                                    value={reminderMessage}
                                    onChangeText={setReminderMessage}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleSendPaymentRequest}
                                disabled={isSending}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={isSending ? ['#9CA3AF', '#6B7280'] : ['#3B82F6', '#2563EB']}
                                    style={styles.sendButton}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {isSending ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="paper-plane-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
                                            <Text style={styles.sendButtonText}>Send Notification</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </Modal>
    );

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
                                    {status === 'present' && getDateHours(dateStr) > 0 ? (
                                        <Text style={{ fontSize: 10, color: '#059669', fontWeight: '700' }}>{getDateHours(dateStr)}h</Text>
                                    ) : status === 'present' ? (
                                        <Ionicons name="checkmark" size={14} color="#059669" />
                                    ) : status === 'absent' ? (
                                        <Ionicons name="close" size={14} color="#DC2626" />
                                    ) : null}
                                </View>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.totalCalculationBox}>
                    <Text style={styles.totalCalculationLabel} numberOfLines={1}>Calculated salary for this month:</Text>
                    <Text style={styles.totalCalculationValue}>₹{calculatedTotal.toFixed(2)}</Text>
                    {staff?.service_rate_type === 'hourly' && totalHoursInMonth > 0 ? (
                        <Text style={styles.rateInfoText}>
                            Rate: ₹{staff?.service_rate || 0} / hr  |  Total: {totalHoursInMonth} hrs
                        </Text>
                    ) : (
                        <Text style={styles.rateInfoText}>
                            Rate: ₹{staff?.service_rate || 0} / {staff?.service_rate_type || 'day'}
                        </Text>
                    )}

                    {calculatedTotal > 0 && (
                        <TouchableOpacity
                            style={{ marginTop: 15 }}
                            onPress={() => setShowPaymentRequestModal(true)}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#2563EB']}
                                style={styles.paymentRequestBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Ionicons name="time-outline" size={20} color="#fff" />
                                <Text style={styles.paymentRequestText}>Payment Request</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
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
                            {staff?.service_rate_type === 'hourly' && staff?.service_daily_hours && (
                                <View style={styles.infoRow}>
                                    <Text style={styles.label}>Default Daily Hours:</Text>
                                    <Text style={styles.value}>{staff.service_daily_hours} hrs</Text>
                                </View>
                            )}
                        </View>
                        {renderCalendar()}
                    </View>
                </ScrollView>
                <CustomerBottomNav
                    activeTab="ledger"
                    setActiveTab={(tab) => navigation.navigate('CustomerDashboard', { tab })}
                />
                {renderPaymentRequestModal()}
                {renderToast()}
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
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 140,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
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
    paymentRequestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 10,
        gap: 8,
    },
    paymentRequestText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#F3F4F6',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 8,
    },
    modalCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modalCardLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    modalCardValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginTop: 2,
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    formGroup: {
        marginBottom: 20,
    },
    dropdownTrigger: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownValue: {
        fontSize: 15,
        color: '#111827',
    },
    dropdownMenu: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    dropdownItemActive: {
        backgroundColor: '#EFF6FF',
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#374151',
    },
    dropdownItemTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },
    textInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        textAlignVertical: 'top',
        minHeight: 80,
    },
    sendButton: {
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 8,
    },
    toastContainer: { position: 'absolute', bottom: 40, left: 20, right: 20, zIndex: 1000 },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    toastIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    toastText: { fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
});

export default StaffLedgerDetailScreen;

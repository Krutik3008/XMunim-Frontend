import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
    Animated,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { customerAPI, getAPIErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ShopHeader from '../../components/shopowner/ShopHeader';
import { LinearGradient } from 'expo-linear-gradient';

const ServiceDetailScreen = ({ route, navigation }) => {
    const { customer: initialCustomer, shopId } = route.params;
    const { user } = useAuth();
    const [customer, setCustomer] = useState(initialCustomer);
    const [loading, setLoading] = useState(false);
    const [shopDetails, setShopDetails] = useState(null);

    // Service Delivery Calendar state
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [serviceRate, setServiceRate] = useState(initialCustomer?.service_rate?.toString() || '');
    const [serviceRateType, setServiceRateType] = useState(initialCustomer?.service_rate_type || 'daily');
    const [serviceLog, setServiceLog] = useState(initialCustomer?.service_log || {});
    const [isSavingRate, setIsSavingRate] = useState(false);
    const [calculatedTotal, setCalculatedTotal] = useState(0);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [toastType, setToastType] = useState('success');
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef(null);

    // Edit Customer State
    const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editNickname, setEditNickname] = useState('');
    const [updatingCustomer, setUpdatingCustomer] = useState(false);

    useEffect(() => {
        calculateTotal();
    }, [serviceLog, serviceRate, serviceRateType, currentMonth]);

    const showToast = (message, type = 'success') => {
        Keyboard.dismiss();
        if (toastTimer.current) clearTimeout(toastTimer.current);

        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);
        Animated.spring(toastAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
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
                                outputRange: [80, 0],
                            }),
                        }],
                    },
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
    const getDateStatus = (dateStr) => {
        // Remove automatic logic, only return what is stored or null
        return serviceLog[dateStr] || null;
    };

    const calculateTotal = () => {
        if (!serviceRate || isNaN(parseFloat(serviceRate))) {
            setCalculatedTotal(0);
            return;
        }

        const rate = parseFloat(serviceRate);
        const year = currentMonth.getFullYear();
        const monthNum = currentMonth.getMonth();
        const monthStr = (monthNum + 1).toString().padStart(2, '0');
        const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
        const monthPrefix = `${year}-${monthStr}`;

        if (serviceRateType === 'monthly') {
            // Monthly: Start with full rate, subtract for explicit "absent" markings
            let absentCount = 0;
            Object.keys(serviceLog).forEach(dateStr => {
                if (dateStr.startsWith(monthPrefix) && serviceLog[dateStr] === 'absent') {
                    absentCount++;
                }
            });
            
            const dailyRate = rate / daysInMonth;
            const reduction = absentCount * dailyRate;
            setCalculatedTotal(Math.max(0, rate - reduction));
        } else {
            // Daily/Hourly: Incremental total based on "present" (implicit or explicit)
            let presentCount = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
                if (getDateStatus(dateStr) === 'present') {
                    presentCount++;
                }
            }
            setCalculatedTotal(presentCount * rate);
        }
    };

    const handleSaveRateSettings = async () => {
        if (!serviceRate || isNaN(parseFloat(serviceRate))) {
            showToast('Please enter a valid numeric rate', 'error');
            return;
        }

        setIsSavingRate(true);
        try {
            const updateData = {
                service_rate: parseFloat(serviceRate),
                service_rate_type: serviceRateType
            };
            await customerAPI.updateServiceData(shopId, customer.id, updateData);
            setCustomer(prev => ({ ...prev, ...updateData }));
            showToast('Rate settings saved successfully');
        } catch (error) {
            showToast(getAPIErrorMessage(error) || 'Failed to save rate', 'error');
        } finally {
            setIsSavingRate(false);
        }
    };

    const toggleDateStatus = async (dateStr) => {
        // Restriction logic: ONLY allow editing the current date
        try {
            const isToday = new Date().toDateString() === new Date(dateStr).toDateString();

            if (!isToday) {
                showToast("Only today's attendance can be edited", "error");
                return;
            }
        } catch (e) {
            console.error('Error in toggleDateStatus restriction:', e);
        }

        const currentStatus = serviceLog[dateStr];
        let newStatus = 'present';
        
        // Cycle: null -> present -> absent -> null
        if (!currentStatus) newStatus = 'present';
        else if (currentStatus === 'present') newStatus = 'absent';
        else if (currentStatus === 'absent') newStatus = null;

        const updatedLog = { ...serviceLog };
        if (newStatus === null) {
            delete updatedLog[dateStr];
        } else {
            updatedLog[dateStr] = newStatus;
        }
        setServiceLog(updatedLog);

        try {
            await customerAPI.updateServiceData(shopId, customer.id, {
                date: dateStr,
                status: newStatus
            });
        } catch (error) {
            showToast('Failed to sync calendar update', 'error');
            setServiceLog(serviceLog); // Revert
        }
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
                        
                        const cellDate = new Date(year, month, day);
                        const todayDate = new Date();
                        todayDate.setHours(0, 0, 0, 0);
                        const isFuture = cellDate > todayDate;
                        const isPast = cellDate < todayDate;

                        let cellBg = '#F9FAFB';
                        let cellBorder = '#E5E7EB';
                        if (status === 'present') {
                            cellBg = '#D1FAE5';
                            cellBorder = '#10B981';
                        } else if (status === 'absent') {
                            cellBg = '#FEE2E2';
                            cellBorder = '#EF4444';
                        }
                        
                        // Highlight today if no EXPLICIT status is set yet (though getDateStatus handles 6am implicit)
                        const hasExplicitStatus = !!serviceLog[dateStr];
                        if (isToday && !hasExplicitStatus && status !== 'present') {
                            cellBg = '#EFF6FF';
                            cellBorder = '#3B82F6';
                        }

                        return (
                            <TouchableOpacity
                                key={dateStr}
                                style={[
                                    styles.dayCell, 
                                    { backgroundColor: cellBg, borderColor: cellBorder },
                                    isFuture && { opacity: 0.5 } // Dim only future dates
                                ]}
                                onPress={() => toggleDateStatus(dateStr)}
                                disabled={!isToday} // Disable interaction for all dates except today
                            >
                                <Text style={[styles.dayText, isFuture && { color: '#9CA3AF' }]}>{day}</Text>
                                <View style={styles.statusIndicator}>
                                    {status === 'present' && <Ionicons name="checkmark" size={14} color="#059669" />}
                                    {status === 'absent' && <Ionicons name="close" size={14} color="#DC2626" />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.totalCalculationBox}>
                    <Text style={styles.totalCalculationLabel}>Estimated total for this month:</Text>
                    <Text style={styles.totalCalculationValue}>₹{calculatedTotal.toFixed(2)}</Text>
                </View>
            </View>
        );
    };

    const openEditModal = () => {
        setEditName(customer.name);
        setEditPhone(customer.phone);
        setEditNickname(customer.nickname || '');
        setShowEditCustomerModal(true);
    };

    const handleUpdateCustomer = async () => {
        if (!editName.trim()) {
            showToast('Please enter member name', 'error');
            return;
        }
        if (!editPhone.trim() || editPhone.length !== 10) {
            showToast('Please enter valid 10-digit phone', 'error');
            return;
        }

        Keyboard.dismiss();

        const phoneChanged = editPhone.trim() !== customer.phone;
        const savedPhone = editPhone.trim();
        const savedName = editName.trim();

        setUpdatingCustomer(true);
        try {
            const updateData = {
                name: editName.trim(),
                phone: editPhone.trim(),
                nickname: editNickname.trim() || null
            };
            await customerAPI.update(shopId, customer.id, updateData);
            
            showToast('Details updated successfully');
            setShowEditCustomerModal(false);

            setCustomer(prev => ({ ...prev, ...updateData, is_verified: phoneChanged ? false : prev.is_verified }));

            if (phoneChanged) {
                setTimeout(() => {
                    Alert.alert(
                        'Phone Number Changed',
                        'Since the phone number has changed, the member needs to be re-verified. Send verification link now?',
                        [
                            { text: 'Skip', style: 'cancel' },
                            {
                                text: 'Send Link',
                                onPress: () => handleSendVerificationWithData(savedPhone, savedName)
                            }
                        ]
                    );
                }, 500);
            }
        } catch (error) {
            showToast(getAPIErrorMessage(error) || 'Update failed', 'error');
        } finally {
            setUpdatingCustomer(false);
        }
    };

    const handleSendVerificationWithData = async (phone, name) => {
        try {
            const response = await customerAPI.sendVerification(shopId, customer.id);
            const link = response.data?.verification_link;
            if (link) {
                const message = `Hello ${name},\nVerify your number: ${link}`;
                const url = `whatsapp://send?phone=91${phone}&text=${encodeURIComponent(message)}`;
                await Linking.openURL(url).catch(() => Linking.openURL(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`));
                showToast('Verification link sent');
            }
        } catch (error) {
            showToast('Failed to send link', 'error');
        }
    };

    const handleSendVerification = async () => {
        try {
            const response = await customerAPI.sendVerification(shopId, customer.id);
            const link = response.data?.verification_link;
            if (link) {
                const message = `Hello ${customer.name},\nVerify your number: ${link}`;
                const url = `whatsapp://send?phone=91${customer.phone}&text=${encodeURIComponent(message)}`;
                await Linking.openURL(url).catch(() => Linking.openURL(`https://wa.me/91${customer.phone}?text=${encodeURIComponent(message)}`));
                showToast('Verification link sent');
            }
        } catch (error) {
            showToast('Failed to send link', 'error');
        }
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={{ flex: 1 }}>
                {/* Header */}
                <ShopHeader shopName={user?.shop_name || 'XMunim'} />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Top Row: Back & Title */}
                    <View style={styles.backRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#374151" />
                        </TouchableOpacity>
                        <View style={styles.pageTitle}>
                            <Text style={styles.pageTitleText}>Service Details</Text>
                            <Text style={styles.pageSubtitle}>Attendance & Rate Tracking</Text>
                        </View>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity onPress={openEditModal} style={styles.editBtn}>
                            <Ionicons name="create-outline" size={24} color="#3B82F6" />
                        </TouchableOpacity>
                    </View>

                    {/* Member Info Card */}
                    <View style={styles.customerCard}>
                        <View style={styles.customerLeft}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={[styles.customerName, { flexShrink: 1, marginRight: 10 }]}>
                                    {customer.name}
                                    {customer.nickname ? ` (${customer.nickname})` : ''}
                                </Text>
                                {customer.is_verified ? (
                                    <View style={styles.verifiedBadgeName}>
                                        <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                                        <Text style={[styles.badgeTextName, { color: '#10B981' }]}>Verified</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.unverifiedBadgeName}
                                        onPress={handleSendVerification}
                                    >
                                        <Ionicons name="alert-circle" size={12} color="#EF4444" />
                                        <Text style={[styles.badgeTextName, { color: '#EF4444' }]}>Unverified</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text style={styles.customerPhone}>+91 {customer.phone}</Text>
                        </View>
                    </View>

                    {/* Rate Settings Card */}
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Rate Settings</Text>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Current Rate (₹)</Text>
                            <View style={styles.rateInputRow}>
                                <TextInput
                                    style={styles.rateTextInput}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={serviceRate}
                                    onChangeText={setServiceRate}
                                />
                                <View style={styles.rateTypeContainer}>
                                    {['hourly', 'daily', 'monthly'].map((type) => (
                                        <TouchableOpacity
                                            key={type}
                                            style={[styles.rateTypeBtn, serviceRateType === type && styles.rateTypeBtnActive]}
                                            onPress={() => setServiceRateType(type)}
                                        >
                                            <Text style={[styles.rateTypeBtnText, serviceRateType === type && styles.rateTypeBtnTextActive]}>
                                                {type}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity onPress={handleSaveRateSettings} disabled={isSavingRate}>
                            <LinearGradient
                                colors={['#3B82F6', '#2563EB']}
                                style={styles.saveBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {isSavingRate ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Settings</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Calendar Tracking Card */}
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Attendance / Delivery Log</Text>
                        {renderCalendar()}
                    </View>
                </ScrollView>

                {/* Edit Modal */}
                <Modal
                    visible={showEditCustomerModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowEditCustomerModal(false)}
                    statusBarTranslucent={true}
                >
                    <KeyboardAvoidingView
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Edit Member</Text>
                                <TouchableOpacity onPress={() => {
                                    Keyboard.dismiss();
                                    setShowEditCustomerModal(false);
                                }}>
                                    <Ionicons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                                Name <Text style={{ color: '#EF4444' }}>*</Text>
                            </Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 }}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Enter member name"
                                placeholderTextColor="#9CA3AF"
                            />

                            <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                                Phone <Text style={{ color: '#EF4444' }}>*</Text>
                            </Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 }}
                                value={editPhone}
                                onChangeText={(text) => setEditPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
                                keyboardType="numeric"
                                placeholder="Enter phone number"
                                placeholderTextColor="#9CA3AF"
                            />

                            <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>Nickname</Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16 }}
                                value={editNickname}
                                onChangeText={setEditNickname}
                                placeholder="Optional"
                                placeholderTextColor="#9CA3AF"
                            />

                            <TouchableOpacity
                                style={{ backgroundColor: '#3B82F6', padding: 14, borderRadius: 8, alignItems: 'center' }}
                                onPress={handleUpdateCustomer}
                                disabled={updatingCustomer}
                            >
                                {updatingCustomer ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Update Member</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        {renderToast()}
                    </KeyboardAvoidingView>
                </Modal>

                {renderToast()}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    scrollView: { flex: 1 },
    scrollViewContent: { padding: 16, paddingBottom: 40 },
    backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    backButton: { padding: 4 },
    pageTitle: { marginLeft: 12 },
    pageTitleText: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
    pageSubtitle: { fontSize: 13, color: '#666' },
    editBtn: { padding: 4 },
    customerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    customerLeft: { flex: 1 },
    customerName: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
    customerPhone: { fontSize: 14, color: '#666', marginTop: 2 },
    nickname: { fontSize: 13, color: '#3B82F6', fontStyle: 'italic', fontWeight: '500' },
    verifyBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    verifyBtnText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
    verifiedBadgeName: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8,
        gap: 4,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    unverifiedBadgeName: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8,
        gap: 4,
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    badgeTextName: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
    rateInputRow: { flexDirection: 'column', gap: 12 },
    rateTextInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        padding: 12,
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    rateTypeContainer: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 4,
        marginTop: 4,
    },
    rateTypeBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rateTypeBtnActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    rateTypeBtnText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    rateTypeBtnTextActive: {
        color: '#2563EB',
        fontWeight: '700',
    },
    saveBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    calendarContainer: {},
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    monthNavBtn: { padding: 6, backgroundColor: '#F3F4F6', borderRadius: 8 },
    monthLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
    weekDaysRow: { flexDirection: 'row', marginBottom: 8 },
    weekDayText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        borderWidth: 0.5,
        borderColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    dayText: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
    statusIndicator: { height: 16, marginTop: 2 },
    totalCalculationBox: {
        marginTop: 20,
        backgroundColor: '#EFF6FF',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    totalCalculationLabel: { fontSize: 13, color: '#3B82F6', fontWeight: '600', marginBottom: 4 },
    totalCalculationValue: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
    toastContainer: { position: 'absolute', bottom: 40, left: 20, right: 20, zIndex: 1000 },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    toastIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    toastText: { fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
    modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 16 },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#F3F4F6' },
    confirmBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#3B82F6' },
});

export default ServiceDetailScreen;

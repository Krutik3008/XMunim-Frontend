import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
    Animated,
    Linking,
    Switch,
    RefreshControl,
    TouchableWithoutFeedback,
    Dimensions
} from 'react-native';
import Modal from '../../components/ui/Modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { customerAPI, getAPIErrorMessage, serviceAPI, shopAPI, staffAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ShopHeader from '../../components/shopowner/ShopHeader';
import ShopBottomNav from '../../components/shopowner/ShopBottomNav';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

const StaffDetailScreen = ({ route, navigation }) => {
    const { customer: initialCustomer, shopId, serviceId, type } = route.params;
    const { user } = useAuth();
    
    // Choose which API to use based on type
    const activeAPI = type === 'services' ? serviceAPI : (type === 'staff' ? staffAPI : customerAPI);
    const activeId = serviceId || initialCustomer?.id;
    const [customer, setCustomer] = useState(initialCustomer);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [shopDetails, setShopDetails] = useState(null);

    // Service Delivery Calendar state
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [serviceRate, setServiceRate] = useState(initialCustomer?.service_rate?.toString() || '');
    const [serviceDailyHours, setServiceDailyHours] = useState(initialCustomer?.service_daily_hours?.toString() || '8');
    const [serviceRateType, setServiceRateType] = useState(initialCustomer?.service_rate_type || 'daily');
    const [serviceLog, setServiceLog] = useState(initialCustomer?.service_log || {});
    const [isSavingRate, setIsSavingRate] = useState(false);
    const [calculatedTotal, setCalculatedTotal] = useState(0);
    const [totalHoursInMonth, setTotalHoursInMonth] = useState(0);

    // Hours Input Modal (for hourly type)
    const [showHoursModal, setShowHoursModal] = useState(false);
    const [hoursInput, setHoursInput] = useState('');
    const [editingDateStr, setEditingDateStr] = useState(null);

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
    const [editUpiId, setEditUpiId] = useState('');
    const [updatingCustomer, setUpdatingCustomer] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    // Payment Request Modal

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const response = await activeAPI.getById(shopId, activeId);
            const updatedCustomer = response.data;
            if (updatedCustomer) {
                setCustomer(updatedCustomer);
                setServiceRate(updatedCustomer.service_rate?.toString() || '');
                setServiceRateType(updatedCustomer.service_rate_type || 'daily');
                setServiceLog(updatedCustomer.service_log || {});
            }

            // Fetch shop details for branding
            try {
                const shopRes = await shopAPI.getDashboard(shopId);
                setShopDetails(shopRes.data?.shop);
            } catch (e) {
                console.log('Failed to load shop details:', e);
            }
        } catch (error) {
            showToast(getAPIErrorMessage(error) || 'Failed to load details', 'error');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData(false);
        setRefreshing(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData(false);
        }, [shopId, activeId])
    );

    useEffect(() => {
        calculateTotal();
    }, [serviceLog, customer.service_rate, customer.service_rate_type, currentMonth]);

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
        const savedRate = customer.service_rate;
        const savedRateType = customer.service_rate_type;

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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

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
            // Daily: Incremental total based on "present"
            let total = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
                const status = getDateStatus(dateStr);
                if (status === 'present') {
                    const entryDate = new Date(dateStr);
                    entryDate.setHours(0, 0, 0, 0);
                    if (entryDate < today) {
                        const entry = serviceLog[dateStr];
                        const storedRate = (typeof entry === 'object' && entry !== null && entry.rate !== undefined) 
                            ? entry.rate 
                            : (customer.service_rate || globalRate); 
                        total += storedRate;
                    } else {
                        total += globalRate;
                    }
                }
            }
            setCalculatedTotal(total);
            setTotalHoursInMonth(0);
        }
    };

    const handleSaveRateSettings = async () => {
        if (!customer.is_verified) {
            showToast('First Verify the customer before changes', 'error');
            return;
        }

        if (!serviceRate || isNaN(parseFloat(serviceRate))) {
            showToast('Please enter a valid numeric rate', 'error');
            return;
        }

        if (serviceRateType === 'hourly') {
            const hrs = parseFloat(serviceDailyHours);
            if (!serviceDailyHours || isNaN(hrs) || hrs <= 0) {
                showToast('Please enter Default Daily Hours', 'error');
                return;
            }
        }

        setIsSavingRate(true);
        try {
            // Migration: 
            // 1. Convert legacy strings to objects using previous rate
            // 2. Update Today/Future entries to use the NEW rate
            const migratedLog = { ...serviceLog };
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            Object.keys(migratedLog).forEach(dateStr => {
                const entry = migratedLog[dateStr];
                const entryDate = new Date(dateStr);
                entryDate.setHours(0, 0, 0, 0);

                if (entryDate >= today) {
                    // Today or Future: ALWAYS use the new rate being saved
                    if (typeof entry === 'object' && entry !== null) {
                        migratedLog[dateStr] = { ...entry, rate: parseFloat(serviceRate) };
                    } else if (typeof entry === 'string') {
                        migratedLog[dateStr] = { status: entry, rate: parseFloat(serviceRate) };
                    }
                } else if (typeof entry === 'string') {
                    // Past Legacy string: Use previous saved rate (customer.service_rate)
                    // This "locks" the past price before the new one takes over
                    migratedLog[dateStr] = {
                        status: entry,
                        rate: customer.service_rate || parseFloat(serviceRate)
                    };
                }
                // Past objects stay as they are (preserving their historical rate)
            });

            const updateData = {
                service_rate: parseFloat(serviceRate),
                service_rate_type: serviceRateType,
                service_daily_hours: parseFloat(serviceDailyHours) || 8,
                service_log: migratedLog
            };
            await activeAPI.updateServiceData(shopId, customer.id, updateData);
            setCustomer(prev => ({ ...prev, ...updateData }));
            setServiceLog(migratedLog);
            showToast('Rate settings saved successfully');
        } catch (error) {
            showToast(getAPIErrorMessage(error) || 'Failed to save rate', 'error');
        } finally {
            setIsSavingRate(false);
        }
    };

    const toggleDateStatus = async (dateStr) => {
        if (!customer.is_verified) {
            showToast('First Verify the customer before changes', 'error');
            return;
        }

        try {
            const isToday = new Date().toDateString() === new Date(dateStr).toDateString();
            if (!isToday) {
                showToast("Only today's attendance can be edited", "error");
                return;
            }
        } catch (e) {
            console.error('Error in toggleDateStatus restriction:', e);
        }

        const currentStatus = getDateStatus(dateStr);
        let newStatus = 'present';
        if (!currentStatus) newStatus = 'present';
        else if (currentStatus === 'present') newStatus = 'absent';
        else if (currentStatus === 'absent') newStatus = null;

        const updatedLog = { ...serviceLog };
        const currentRate = parseFloat(serviceRate);

        if (newStatus === null) {
            delete updatedLog[dateStr];
        } else {
            if (serviceRateType === 'hourly' && newStatus === 'present') {
                const defaultHrs = parseFloat(serviceDailyHours) || 8;
                updatedLog[dateStr] = {
                    status: newStatus,
                    rate: currentRate,
                    hours: defaultHrs,
                    hours_log: [{ hours: defaultHrs, rate: currentRate }]
                };
            } else {
                updatedLog[dateStr] = {
                    status: newStatus,
                    rate: currentRate
                };
            }
        }
        setServiceLog(updatedLog);

        try {
            await activeAPI.updateServiceData(shopId, customer.id, {
                service_log: updatedLog
            });
        } catch (error) {
            showToast('Failed to sync calendar update', 'error');
            setServiceLog(serviceLog);
        }
    };

    const openHoursModal = (dateStr) => {
        if (!customer.is_verified) {
             showToast('First Verify the customer before changes', 'error');
             return;
        }
        if (new Date().toDateString() !== new Date(dateStr).toDateString()) {
             showToast("Only today's attendance can be edited", "error");
             return;
        }
        if (serviceRateType !== 'hourly') return;

        const existingEntry = serviceLog[dateStr];
        if (typeof existingEntry === 'object' && existingEntry !== null && existingEntry.status === 'present') {
            setHoursInput((existingEntry.hours || '').toString());
        } else {
            setHoursInput(serviceDailyHours?.toString() || '8');
        }
        setEditingDateStr(dateStr);
        setShowHoursModal(true);
    };

    const handleSaveHours = async () => {
        const hours = parseFloat(hoursInput);
        if (!hoursInput || isNaN(hours) || hours <= 0) {
            showToast('Please enter valid hours (must be > 0)', 'error');
            return;
        }

        const dateStr = editingDateStr;
        const currentRate = parseFloat(serviceRate);
        const updatedLog = { ...serviceLog };
        const existingEntry = updatedLog[dateStr];

        if (typeof existingEntry === 'object' && existingEntry !== null && existingEntry.status === 'present' && existingEntry.hours_log) {
            // Updating existing entry — check if rate changed since last log
            const lastLog = existingEntry.hours_log[existingEntry.hours_log.length - 1];
            const oldTotalHours = existingEntry.hours || 0;
            const additionalHours = hours - oldTotalHours;

            if (additionalHours > 0 && lastLog && lastLog.rate !== currentRate) {
                // Rate changed — add new segment with remaining hours at new rate
                updatedLog[dateStr] = {
                    ...existingEntry,
                    hours: hours,
                    rate: currentRate,
                    hours_log: [...existingEntry.hours_log, { hours: additionalHours, rate: currentRate }]
                };
            } else if (additionalHours !== 0) {
                // Same rate — update the last log entry
                const newLog = [...existingEntry.hours_log];
                if (newLog.length > 0) {
                    newLog[newLog.length - 1] = { ...newLog[newLog.length - 1], hours: newLog[newLog.length - 1].hours + additionalHours };
                    // If last log became 0 or negative, remove it
                    if (newLog[newLog.length - 1].hours <= 0) newLog.pop();
                }
                updatedLog[dateStr] = {
                    ...existingEntry,
                    hours: hours,
                    rate: currentRate,
                    hours_log: newLog.length > 0 ? newLog : [{ hours: hours, rate: currentRate }]
                };
            } else {
                // No change in hours, just update rate reference
                updatedLog[dateStr] = { ...existingEntry, rate: currentRate };
            }
        } else {
            // New entry or replacing absent
            updatedLog[dateStr] = {
                status: 'present',
                rate: currentRate,
                hours: hours,
                hours_log: [{ hours: hours, rate: currentRate }]
            };
        }

        setServiceLog(updatedLog);
        setShowHoursModal(false);

        try {
            await activeAPI.updateServiceData(shopId, customer.id, {
                service_log: updatedLog
            });
        } catch (error) {
            showToast('Failed to sync hours update', 'error');
            setServiceLog(serviceLog);
        }
    };

    const handleMarkAbsent = async () => {
        const dateStr = editingDateStr;
        const updatedLog = { ...serviceLog };
        updatedLog[dateStr] = {
            status: 'absent',
            rate: parseFloat(serviceRate)
        };
        setServiceLog(updatedLog);
        setShowHoursModal(false);

        try {
            await activeAPI.updateServiceData(shopId, customer.id, {
                service_log: updatedLog
            });
        } catch (error) {
            showToast('Failed to sync update', 'error');
            setServiceLog(serviceLog);
        }
    };

    const handleClearDay = async () => {
        const dateStr = editingDateStr;
        const updatedLog = { ...serviceLog };
        delete updatedLog[dateStr];
        setServiceLog(updatedLog);
        setShowHoursModal(false);

        try {
            await activeAPI.updateServiceData(shopId, customer.id, {
                service_log: updatedLog
            });
        } catch (error) {
            showToast('Failed to sync update', 'error');
            setServiceLog(serviceLog);
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
                                onLongPress={() => openHoursModal(dateStr)}
                                disabled={!isToday} // Disable interaction for all dates except today
                            >
                                <Text style={[styles.dayText, isFuture && { color: '#9CA3AF' }]}>{day}</Text>
                                <View style={styles.statusIndicator}>
                                    {status === 'present' && serviceRateType === 'hourly' && getDateHours(dateStr) > 0 ? (
                                        <Text style={{ fontSize: 10, color: '#059669', fontWeight: '700' }}>{getDateHours(dateStr)}h</Text>
                                    ) : status === 'present' ? (
                                        <Ionicons name="checkmark" size={14} color="#059669" />
                                    ) : status === 'absent' ? (
                                        <Ionicons name="close" size={14} color="#DC2626" />
                                    ) : null}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.totalCalculationBox}>
                    <Text style={styles.totalCalculationLabel}>Estimated total for this month:</Text>
                    <Text style={styles.totalCalculationValue}>₹{calculatedTotal.toFixed(2)}</Text>
                    {serviceRateType === 'hourly' && totalHoursInMonth > 0 && (
                        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4, fontStyle: 'italic' }}>
                            Total: {totalHoursInMonth} hours × ₹{serviceRate}/hr
                        </Text>
                    )}
                    
                    {calculatedTotal > 0 && (
                        <TouchableOpacity 
                            style={{ marginTop: 15 }} 
                            onPress={handlePay}
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#2563EB']}
                                style={styles.paymentRequestBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Ionicons name="card-outline" size={20} color="#fff" />
                                <Text style={styles.paymentRequestText}>Pay</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const openEditModal = () => {
        setEditName(customer.name);
        setEditPhone(customer.phone);
        setEditNickname(customer.nickname || '');
        setEditUpiId(customer.upi_id || '');
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
                nickname: editNickname.trim() || null,
                upi_id: editUpiId.trim() || null
            };
            await activeAPI.update(shopId, customer.id, updateData);
            
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
    
    const handlePay = async () => {
        const upiId = customer.upi_id;
        const name = customer.name || 'Member';
        const amount = calculatedTotal.toFixed(2);

        if (!upiId) {
            showToast('UPI ID not set. Please edit details to add UPI ID.', 'error');
            return;
        }

        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Payment to ${name}`)}`;

        try {
            const supported = await Linking.canOpenURL(upiUrl);
            if (supported) {
                await Linking.openURL(upiUrl);
            } else {
                showToast('No UPI app found on this device', 'error');
            }
        } catch (error) {
            console.error('UPI payment error:', error);
            showToast('Failed to open UPI app', 'error');
        }
    };

    const handleSendVerificationWithData = async (phone, name) => {
        try {
            const response = await activeAPI.sendVerification(shopId, customer.id);
            const link = response.data?.verification_link;
            if (link) {
                const shopName = shopDetails?.name || user?.shop_name || 'our shop';
                const message = `Hello ${name || 'Member'},\n\nYou have been added to ${shopName}'s digital ledger on XMunim. Please verify your number to get started: ${link}\n\nThank you!`;
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
            const response = await activeAPI.sendVerification(shopId, customer.id);
            const link = response.data?.verification_link;
            if (link) {
                const shopName = shopDetails?.name || user?.shop_name || 'our shop';
                const message = `Hello ${customer.name},\n\nYou have been added to ${shopName}'s digital ledger on XMunim. Please verify your number to get started: ${link}\n\nThank you!`;
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

    if (!customer && (loading || refreshing)) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ShopHeader shopName={shopDetails?.name || user?.shop_name || 'XMunim'} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!customer) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ShopHeader shopName={shopDetails?.name || user?.shop_name || 'XMunim'} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                    <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#111827' }}>Member Not Found</Text>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                        <Text style={{ color: '#2563EB', fontWeight: '600' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={{ flex: 1 }}>
                {/* Header */}
                <ShopHeader shopName={shopDetails?.name || user?.shop_name || 'XMunim'} />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {/* Top Row: Back & Title */}
                    <View style={styles.backRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#374151" />
                        </TouchableOpacity>
                        <View style={styles.pageTitle}>
                            <Text style={styles.pageTitleText}>Staff Details</Text>
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

                    {/* Verification Pending Banner */}
                    {!customer.is_verified && (
                        <View style={styles.verificationBanner}>
                            <View style={styles.bannerHeader}>
                                <Ionicons name="warning" size={20} color="#92400E" />
                                <Text style={styles.bannerTitle}>Verification Pending. You cannot  change rate and attendance until this staff is verified.</Text>
                            </View>
                            <TouchableOpacity 
                                style={styles.bannerAction}
                                onPress={() => handleSendVerificationWithData(customer.phone, customer.name)}
                            >
                                <Ionicons name="logo-whatsapp" size={18} color="#2563EB" />
                                <Text style={styles.bannerActionText}>Send via WhatsApp</Text>
                            </TouchableOpacity>
                        </View>
                    )}

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
                                {serviceRateType === 'hourly' && (
                                    <View style={{ marginTop: 12 }}>
                                        <Text style={styles.inputLabel}>
                                            Default Daily Hours <Text style={{ color: '#EF4444' }}>*</Text>
                                        </Text>
                                        <TextInput
                                            style={styles.rateTextInput}
                                            placeholder="e.g. 8"
                                            keyboardType="numeric"
                                            value={serviceDailyHours}
                                            onChangeText={setServiceDailyHours}
                                        />
                                    </View>
                                )}
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
                        <Text style={styles.sectionTitle}>Attendance Log</Text>
                        {renderCalendar()}
                    </View>
                </ScrollView>

                {/* Edit Modal */}
                <Modal
                    visible={showEditCustomerModal}
                    onClose={() => setShowEditCustomerModal(false)}
                    title="Edit Member"
                    toast={toastVisible && showEditCustomerModal ? renderToast() : null}
                >
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
                            Name <Text style={{ color: '#EF4444' }}>*</Text>
                        </Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9FAFB' }}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Enter member name"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
                            Phone <Text style={{ color: '#EF4444' }}>*</Text>
                        </Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9FAFB' }}
                            value={editPhone}
                            onChangeText={(text) => setEditPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
                            keyboardType="numeric"
                            placeholder="Enter phone number"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>Nickname</Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9FAFB' }}
                            value={editNickname}
                            onChangeText={setEditNickname}
                            placeholder="Optional"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>UPI ID (for payments)</Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9FAFB' }}
                            value={editUpiId}
                            onChangeText={setEditUpiId}
                            placeholder="e.g. name@upi"
                            placeholderTextColor="#9CA3AF"
                            autoCapitalize="none"
                        />
                    </View>

                    <TouchableOpacity
                        style={{ backgroundColor: '#3B82F6', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 10 }}
                        onPress={handleUpdateCustomer}
                        disabled={updatingCustomer}
                    >
                        {updatingCustomer ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Update Member</Text>
                        )}
                    </TouchableOpacity>
                </Modal>

                {/* Hours Input Modal for Hourly Type */}
                <Modal
                    visible={showHoursModal}
                    onClose={() => setShowHoursModal(false)}
                    title="Log Hours"
                >
                    <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
                            Enter total hours worked for{' '}
                            <Text style={{ fontWeight: '700', color: '#111827' }}>
                                {editingDateStr ? new Date(editingDateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'today'}
                            </Text>
                        </Text>

                        <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
                            Total Hours <Text style={{ color: '#EF4444' }}>*</Text>
                        </Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 18, fontWeight: '700', backgroundColor: '#F9FAFB' }}
                            value={hoursInput}
                            onChangeText={setHoursInput}
                            keyboardType="numeric"
                            placeholder="e.g. 6"
                            placeholderTextColor="#9CA3AF"
                            autoFocus={true}
                        />

                        {hoursInput && !isNaN(parseFloat(hoursInput)) && parseFloat(hoursInput) > 0 && (
                            <View style={{ backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8, marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#3B82F6' }}>
                                <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '600' }}>Calculation Preview</Text>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginTop: 4 }}>
                                    {parseFloat(hoursInput)} hrs × ₹{serviceRate}/hr = ₹{(parseFloat(hoursInput) * parseFloat(serviceRate || 0)).toFixed(2)}
                                </Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={{ backgroundColor: '#3B82F6', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4, marginBottom: 8 }}
                        onPress={handleSaveHours}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Save Hours</Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                            style={{ flex: 1, backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, alignItems: 'center' }}
                            onPress={handleMarkAbsent}
                        >
                            <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 14 }}>Mark Absent</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{ flex: 1, backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, alignItems: 'center' }}
                            onPress={handleClearDay}
                        >
                            <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 14 }}>Clear Day</Text>
                        </TouchableOpacity>
                    </View>
                </Modal>


                {/* Bottom Navigation */}
                <ShopBottomNav activeTab="customers" />

                {renderToast()}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    scrollView: { flex: 1 },
    scrollViewContent: { padding: 16, paddingBottom: 120 },
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
    verificationBanner: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FEF3C7',
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    bannerHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 12,
    },
    bannerTitle: {
        flex: 1,
        fontSize: 14,
        color: '#92400E',
        lineHeight: 20,
    },
    bannerAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bannerActionText: {
        fontSize: 14,
        color: '#2563EB',
        fontWeight: '600',
    },
});

export default StaffDetailScreen;

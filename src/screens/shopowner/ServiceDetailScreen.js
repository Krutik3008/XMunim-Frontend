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
    Linking,
    Switch,
    RefreshControl,
    TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { customerAPI, getAPIErrorMessage, serviceAPI, shopAPI, staffAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ShopHeader from '../../components/shopowner/ShopHeader';
import ShopBottomNav from '../../components/shopowner/ShopBottomNav';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

const ServiceDetailScreen = ({ route, navigation }) => {
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
    const [updatingCustomer, setUpdatingCustomer] = useState(false);

    // Payment Request Modal
    const [showPaymentRequestModal, setShowPaymentRequestModal] = useState(false);

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const response = await activeAPI.getById(shopId, activeId);
            const updatedCustomer = response.data;
            if (updatedCustomer) {
                setCustomer(updatedCustomer);

                // Fetch shop details for branding
                try {
                    const shopRes = await shopAPI.getDashboard(shopId);
                    setShopDetails(shopRes.data?.shop);
                } catch (e) {
                    console.log('Failed to load shop details:', e);
                }
                setServiceRate(updatedCustomer.service_rate?.toString() || '');
                setServiceRateType(updatedCustomer.service_rate_type || 'daily');
                setServiceLog(updatedCustomer.service_log || {});
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
        const entryRateType = entry.rate_type || (entry.hours > 0 ? 'hourly' : 'daily');
        
        if (entryRateType === 'hourly') {
            if (entry.hours_log && Array.isArray(entry.hours_log) && entry.hours_log.length > 0) {
                return entry.hours_log.reduce((sum, log) => sum + (log.hours * log.rate), 0);
            }
            return (entry.hours || 0) * (entry.rate || 0);
        } else {
            // Daily or Monthly (calculated as daily here)
            return entry.rate || 0;
        }
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

        let total = 0;
        let totalHrs = 0;

        // If global mode is monthly, it takes precedence for the base calculation
        if (savedRateType === 'monthly') {
            let absentCount = 0;
            Object.keys(serviceLog).forEach(dateStr => {
                if (dateStr.startsWith(monthPrefix) && getDateStatus(dateStr) === 'absent') {
                    absentCount++;
                }
            });
            const dailyRate = globalRate / daysInMonth;
            total = Math.max(0, globalRate - (absentCount * dailyRate));
        } else {
            // Hybrid Daily/Hourly calculation
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
                const status = getDateStatus(dateStr);
                
                if (status === 'present') {
                    const entry = serviceLog[dateStr];
                    if (typeof entry === 'object' && entry !== null) {
                        const dayAmt = calculateDayTotal(entry);
                        total += dayAmt;
                        if ((entry.rate_type || (entry.hours > 0 ? 'hourly' : 'daily')) === 'hourly') {
                            totalHrs += (entry.hours || 0);
                        }
                    } else if (typeof entry === 'string') {
                        // Legacy string status: treat as daily
                        const entryDate = new Date(dateStr);
                        entryDate.setHours(0, 0, 0, 0);
                        total += (entryDate < today ? (customer.service_rate || globalRate) : globalRate);
                    }
                }
            }
        }
        setCalculatedTotal(total);
        setTotalHoursInMonth(totalHrs);
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
            const migratedLog = { ...serviceLog };
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            Object.keys(migratedLog).forEach(dateStr => {
                let entry = migratedLog[dateStr];
                const entryDate = new Date(dateStr);
                entryDate.setHours(0, 0, 0, 0);

                // Ensure it's an object first
                if (typeof entry === 'string') {
                    entry = { status: entry, rate: customer.service_rate || parseFloat(serviceRate) };
                }

                if (entryDate >= today) {
                    // Today or Future: ALWAYS use the new rate being saved
                    entry.rate = parseFloat(serviceRate);
                    entry.rate_type = serviceRateType; // Persist global rate type into the entry

                    // If switching to HOURLY, ensure present entries have hours
                    if (serviceRateType === 'hourly' && entry.status === 'present' && (!entry.hours || entry.hours === 0)) {
                        const defaultHrs = parseFloat(serviceDailyHours) || 8;
                        entry.hours = defaultHrs;
                        if (!entry.hours_log || entry.hours_log.length === 0) {
                            entry.hours_log = [{ hours: defaultHrs, rate: entry.rate }];
                        }
                    } else if (serviceRateType !== 'hourly') {
                        // Reset hourly fields if switching away from hourly for future dates
                        delete entry.hours;
                        delete entry.hours_log;
                    }
                }
                
                migratedLog[dateStr] = entry;
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
                    rate_type: 'hourly',
                    hours: defaultHrs,
                    hours_log: [{ hours: defaultHrs, rate: currentRate }]
                };
            } else {
                updatedLog[dateStr] = {
                    status: newStatus,
                    rate: currentRate,
                    rate_type: serviceRateType // Store current global rate type (daily/monthly)
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
                rate_type: 'hourly',
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
            rate: parseFloat(serviceRate),
            rate_type: serviceRateType
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
                                    {status === 'present' && getDateHours(dateStr) > 0 ? (
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
                            onPress={() => setShowPaymentRequestModal(true)}
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#2563EB']}
                                style={styles.paymentRequestBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Ionicons name="paper-plane-outline" size={20} color="#fff" />
                                <Text style={styles.paymentRequestText}>Send Payment Request</Text>
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
                const message = `Hello ${customer.name || 'Member'},\n\nYou have been added to ${shopName}'s digital ledger on XMunim. Please verify your number to get started: ${link}\n\nThank you!`;
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

                    {/* Verification Pending Banner */}
                    {!customer.is_verified && (
                        <View style={styles.verificationBanner}>
                            <View style={styles.bannerHeader}>
                                <Ionicons name="warning" size={20} color="#92400E" />
                                <Text style={styles.bannerTitle}>Verification Pending. You cannot change rate and attendance until this service is verified.</Text>
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

                {/* Payment Request Modal */}
                <PaymentRequestModal
                    visible={showPaymentRequestModal}
                    onClose={() => setShowPaymentRequestModal(false)}
                    customer={{
                        ...customer, 
                        balance: -calculatedTotal, 
                        shop_id: shopId,
                        serviceMonth: currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
                        serviceRate: serviceRate,
                        serviceRateType: serviceRateType
                    }}
                    transactions={[]} // Can be fetched if needed, passing empty for now to match prop signature
                    activeAPI={activeAPI}
                    showToast={showToast}
                    renderToast={renderToast}
                />

                {/* Hours Input Modal for Hourly Type */}
                <Modal
                    visible={showHoursModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowHoursModal(false)}
                    statusBarTranslucent={true}
                >
                    <KeyboardAvoidingView
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Log Hours</Text>
                                <TouchableOpacity onPress={() => setShowHoursModal(false)}>
                                    <Ionicons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

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
                                style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, fontSize: 18, fontWeight: '700', backgroundColor: '#F9FAFB' }}
                                value={hoursInput}
                                onChangeText={setHoursInput}
                                keyboardType="numeric"
                                placeholder="e.g. 6"
                                placeholderTextColor="#9CA3AF"
                                autoFocus={true}
                            />

                            {hoursInput && !isNaN(parseFloat(hoursInput)) && parseFloat(hoursInput) > 0 && (
                                <View style={{ backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8, marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#3B82F6', marginBottom: 16 }}>
                                    <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '600' }}>Calculation Preview</Text>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginTop: 4 }}>
                                        {parseFloat(hoursInput)} hrs × ₹{serviceRate}/hr = ₹{(parseFloat(hoursInput) * parseFloat(serviceRate || 0)).toFixed(2)}
                                    </Text>
                                </View>
                            )}
                            
                            {!hoursInput && <View style={{ height: 16 }} />}

                            <TouchableOpacity
                                style={{ backgroundColor: '#3B82F6', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}
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
                        </View>
                        {renderToast()}
                    </KeyboardAvoidingView>
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

const PaymentRequestModal = ({ visible, onClose, customer, transactions, activeAPI, showToast, renderToast }) => {
    const [paymentRequestTab, setPaymentRequestTab] = useState('sendNow');
    const [requestType, setRequestType] = useState('Payment Due Reminder');
    const [sendVia, setSendVia] = useState('Push Notification');
    const [reminderMessage, setReminderMessage] = useState('');
    const [showRequestTypeDropdown, setShowRequestTypeDropdown] = useState(false);
    const [showSendViaDropdown, setShowSendViaDropdown] = useState(false);
    const [scheduleDate, setScheduleDate] = useState(null);
    const [scheduleTime, setScheduleTime] = useState(null);
    const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
    const [showScheduleTimePicker, setShowScheduleTimePicker] = useState(false);
    const [isAutoReminderEnabled, setIsAutoReminderEnabled] = useState(customer?.is_auto_reminder_enabled || false);
    const [autoReminderDelay, setAutoReminderDelay] = useState(customer?.auto_reminder_delay || '3 days overdue');
    const [showAutoReminderDelayDropdown, setShowAutoReminderDelayDropdown] = useState(false);
    const [autoReminderFrequency, setAutoReminderFrequency] = useState(customer?.auto_reminder_frequency || 'Daily until paid');
    const [showAutoReminderFrequencyDropdown, setShowAutoReminderFrequencyDropdown] = useState(false);
    const [autoReminderMethod, setAutoReminderMethod] = useState(customer?.auto_reminder_method || 'Push Notification');
    const [showAutoReminderMethodDropdown, setShowAutoReminderMethodDropdown] = useState(false);
    const [autoReminderMessage, setAutoReminderMessage] = useState(customer?.auto_reminder_message || '');
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [advanceReason, setAdvanceReason] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [notiHistory, setNotiHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const sortedTransactions = transactions ? [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)) : [];

    // Sync state if customer changes
    useEffect(() => {
        if (visible) {
            setScheduleDate(null);
            setScheduleTime(null);
            setReminderMessage('');
            setAdvanceAmount('');
            setAdvanceReason('');
            setRequestType('Payment Due Reminder');
        }
        if (customer) {
            setIsAutoReminderEnabled(customer.is_auto_reminder_enabled || false);
            setAutoReminderDelay(customer.auto_reminder_delay || '3 days overdue');
            setAutoReminderFrequency(customer.auto_reminder_frequency || 'Daily until paid');
            setAutoReminderMethod(customer.auto_reminder_method || 'Push Notification');
            setAutoReminderMessage(customer.auto_reminder_message || '');

            if (visible) {
                fetchHistory();
            }
        }
    }, [customer, visible]);

    const fetchHistory = async () => {
        if (!customer) return;
        setLoadingHistory(true);
        try {
            const response = await activeAPI.getCustomerNotifications(customer.shop_id, customer.id);
            setNotiHistory(response.data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const updateAutoTemplate = (newDelay, newFreq, newMethod) => {
        const delay = newDelay || autoReminderDelay;
        const freq = newFreq || autoReminderFrequency;
        const method = newMethod || autoReminderMethod;

        const customerName = customer?.name || 'Customer';
        const customerBalance = Math.abs(customer?.balance || 0).toFixed(2);

        let template = "";
        if (method === 'WhatsApp') {
            template = `Dear ${customerName},\n\nThis is an automated reminder that your payment is ${delay}.\n\nPending Balance: ₹${customerBalance}\n\nWe will remind you ${freq}.\n\nPlease pay at your earliest convenience. Thank you!`;
        } else if (method === 'SMS Message') {
            template = `XMunim: Dear ${customerName}, your payment is ${delay}. Balance: ₹${customerBalance}. (Auto-reminder: ${freq})`;
        } else {
            template = `Dear ${customerName}, your payment is ${delay}. Balance: ₹${customerBalance}. We will remind you ${freq}. Please clear your dues. Thank you!`;
        }
        setAutoReminderMessage(template);
    };

    const closeAllDropdowns = () => {
        setShowRequestTypeDropdown(false);
        setShowSendViaDropdown(false);
        setShowAutoReminderDelayDropdown(false);
        setShowAutoReminderFrequencyDropdown(false);
        setShowAutoReminderMethodDropdown(false);
    };

    const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

    const formatShortDate = (dateString) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return "Invalid Date";
            return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
        } catch (e) {
            return dateString || "";
        }
    };

    const timeAgo = (dateString) => {
        if (!dateString) return 'No transactions';
        const now = new Date();
        const past = new Date(dateString);
        const diffInMs = now - past;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 7) return `${diffInDays} days ago`;
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
        return dateString.split('T')[0];
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={modalStyles.paymentModalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={modalStyles.paymentModalContent}>
                    {/* Header */}
                    <View style={modalStyles.paymentModalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="time-outline" size={22} color="#EA580C" />
                            <Text style={modalStyles.paymentModalTitle}>Payment Request & Reminders</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle-outline" size={26} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss}>
                        <TouchableWithoutFeedback onPress={() => { closeAllDropdowns(); Keyboard.dismiss(); }}>
                            <View>
                                {/* Customer Details Card */}
                                {customer && (
                                    <View style={modalStyles.paymentCustomerCard}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Customer Details</Text>
                                            <View style={[
                                                modalStyles.statusBadge,
                                                { backgroundColor: customer.balance < 0 ? '#EF4444' : '#111827' }
                                            ]}>
                                                <Text style={modalStyles.statusBadgeText}>
                                                    {customer.balance === 0 ? 'No Dues' : customer.balance < 0 ? 'Pending Payment' : 'Credit Available'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                                            <View style={{ flex: 1, marginRight: 10 }}>
                                                <Text style={modalStyles.cardLabel}>Service Month</Text>
                                                <Text style={modalStyles.cardValue}>{customer.serviceMonth}</Text>
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={modalStyles.cardLabel}>Base Rate</Text>
                                                <Text style={modalStyles.cardValue}>₹{customer.serviceRate} / {customer.serviceRateType}</Text>
                                            </View>
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <View style={{ flex: 1, marginRight: 10 }}>
                                                <Text style={modalStyles.cardLabel}>Calculated Total</Text>
                                                <Text style={[modalStyles.cardValue, { color: '#EF4444' }]}>
                                                    ₹{Math.abs(customer.balance || 0).toFixed(2)}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={modalStyles.cardLabel}>Assigned Member</Text>
                                                <Text style={[modalStyles.cardValue, { fontWeight: '500', color: '#6B7280' }]}>
                                                    {customer.name}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Selection Card */}
                                <View style={modalStyles.paymentModalTabs}>
                                    <TouchableOpacity
                                        style={[modalStyles.paymentModalTab, paymentRequestTab === 'sendNow' && modalStyles.paymentModalTabActive]}
                                        onPress={() => setPaymentRequestTab('sendNow')}
                                    >
                                        <Ionicons name="send-outline" size={16} color={paymentRequestTab === 'sendNow' ? '#111827' : '#6B7280'} />
                                        <Text style={[modalStyles.paymentModalTabText, paymentRequestTab === 'sendNow' && modalStyles.paymentModalTabTextActive]}>Send Now</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[modalStyles.paymentModalTab, paymentRequestTab === 'autoSetup' && modalStyles.paymentModalTabActive]}
                                        onPress={() => setPaymentRequestTab('autoSetup')}
                                    >
                                        <Ionicons name="settings-outline" size={16} color={paymentRequestTab === 'autoSetup' ? '#111827' : '#6B7280'} />
                                        <Text style={[modalStyles.paymentModalTabText, paymentRequestTab === 'autoSetup' && modalStyles.paymentModalTabTextActive]}>Auto Setup</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[modalStyles.paymentModalTab, paymentRequestTab === 'history' && modalStyles.paymentModalTabActive]}
                                        onPress={() => setPaymentRequestTab('history')}
                                    >
                                        <Ionicons name="list-outline" size={16} color={paymentRequestTab === 'history' ? '#111827' : '#6B7280'} />
                                        <Text style={[modalStyles.paymentModalTabText, paymentRequestTab === 'history' && modalStyles.paymentModalTabTextActive]}>History</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Form Content Card */}
                                <View style={modalStyles.paymentMainCard}>
                                    {paymentRequestTab === 'sendNow' ? (
                                        <View style={modalStyles.paymentTabContent}>
                                            <Text style={modalStyles.paymentModalSectionTitle}>Send Reminder</Text>

                                            {/* Request Type */}
                                            <View style={{ marginBottom: 16, zIndex: 20 }}>
                                                <Text style={modalStyles.paymentModalLabel}>Request Type</Text>
                                                <TouchableOpacity
                                                    style={modalStyles.paymentModalDropdown}
                                                    onPress={() => setShowRequestTypeDropdown(!showRequestTypeDropdown)}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <Text style={{ marginLeft: 0, color: '#111827' }}>{requestType}</Text>
                                                        </View>
                                                    </View>
                                                    <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                                                </TouchableOpacity>


                                                {showRequestTypeDropdown && (
                                                    <View style={modalStyles.paymentModalDropdownOptions}>
                                                        <TouchableOpacity
                                                            style={[
                                                                modalStyles.paymentModalDropdownOption,
                                                                requestType === 'Payment Due Reminder' && { backgroundColor: '#F3F4F6' }
                                                            ]}
                                                            onPress={() => {
                                                                setRequestType('Payment Due Reminder');
                                                                setShowRequestTypeDropdown(false);
                                                                setAdvanceAmount('');
                                                                setAdvanceReason('');
                                                                setReminderMessage('');
                                                            }}
                                                        >
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <Ionicons name="cash-outline" size={16} color="#374151" />
                                                                    <Text style={{ marginLeft: 8, color: '#374151', fontSize: 14 }}>Payment Due Reminder</Text>
                                                                </View>
                                                                {requestType === 'Payment Due Reminder' && (
                                                                    <Ionicons name="checkmark-sharp" size={16} color="#374151" />
                                                                )}
                                                            </View>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[
                                                                modalStyles.paymentModalDropdownOption,
                                                                requestType === 'Advance Payment Request' && { backgroundColor: '#F3F4F6' }
                                                            ]}
                                                            onPress={() => {
                                                                setRequestType('Advance Payment Request');
                                                                setShowRequestTypeDropdown(false);
                                                                setAdvanceAmount('');
                                                                setAdvanceReason('');
                                                                setReminderMessage('');
                                                            }}
                                                        >
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <Ionicons name="trending-up-outline" size={16} color="#374151" />
                                                                    <Text style={{ marginLeft: 8, color: '#374151', fontSize: 14 }}>Advance Payment Request</Text>
                                                                </View>
                                                                <View style={{ backgroundColor: '#111827', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>New Order</Text>
                                                                </View>
                                                            </View>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Status Box */}
                                            {requestType === 'Payment Due Reminder' && (
                                                <View style={[modalStyles.paymentStatusBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                                                    <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
                                                    <Text style={[modalStyles.paymentStatusText, { color: '#DC2626' }]}>
                                                        Payment Pending of {formatCurrency(Math.abs(customer?.balance || 0))}
                                                    </Text>
                                                </View>
                                            )}
                                                                                    {/* Advance Payment Form */}
                                            {requestType === 'Advance Payment Request' && (
                                                <View style={modalStyles.advanceInfoCard}>
                                                    <View style={{ marginBottom: 16 }}>
                                                        <Text style={modalStyles.advanceInputLabel}>Advance Amount *</Text>
                                                        <View style={modalStyles.advanceInputWrapper}>
                                                            <TextInput
                                                                style={modalStyles.advanceTextInput}
                                                                placeholder="Enter amount"
                                                                placeholderTextColor="#9CA3AF"
                                                                keyboardType="numeric"
                                                                value={advanceAmount}
                                                                onChangeText={setAdvanceAmount}
                                                            />
                                                        </View>
                                                    </View>

                                                    <View style={{ marginBottom: 16 }}>
                                                        <Text style={modalStyles.advanceInputLabel}>Reason/Purpose</Text>
                                                        <View style={modalStyles.advanceInputWrapper}>
                                                            <TextInput
                                                                style={modalStyles.advanceTextInput}
                                                                placeholder="e.g., New order"
                                                                placeholderTextColor="#9CA3AF"
                                                                value={advanceReason}
                                                                onChangeText={setAdvanceReason}
                                                            />
                                                        </View>
                                                    </View>

                                                    <View style={modalStyles.advanceTipRow}>
                                                        <Text style={modalStyles.advanceTipText}>💡 Advance payments help secure orders and improve cash flow</Text>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Send Via */}
                                            <View style={{ marginBottom: 16, zIndex: 10 }}>
                                                <Text style={modalStyles.paymentModalLabel}>Send Via</Text>
                                                <TouchableOpacity
                                                    style={modalStyles.paymentModalDropdown}
                                                    onPress={() => setShowSendViaDropdown(!showSendViaDropdown)}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Ionicons name="chatbubble-ellipses-outline" size={16} color="#374151" />
                                                        <Text style={{ marginLeft: 8, color: '#111827' }}>{sendVia}</Text>
                                                    </View>
                                                    <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                                                </TouchableOpacity>
                                                {showSendViaDropdown && (
                                                    <View style={modalStyles.paymentModalDropdownOptions}>
                                                        <TouchableOpacity
                                                            style={[modalStyles.paymentModalDropdownOption, sendVia === 'Push Notification' && { backgroundColor: '#F3F4F6' }]}
                                                            onPress={() => { setSendVia('Push Notification'); setShowSendViaDropdown(false); }}
                                                        >
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <Ionicons name="notifications-outline" size={16} color="#374151" />
                                                                    <Text style={{ marginLeft: 8, color: '#374151' }}>Push Notification</Text>
                                                                </View>
                                                                {sendVia === 'Push Notification' && <Ionicons name="checkmark-sharp" size={16} color="#374151" />}
                                                            </View>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[modalStyles.paymentModalDropdownOption, sendVia === 'SMS Message' && { backgroundColor: '#F3F4F6' }]}
                                                            onPress={() => { setSendVia('SMS Message'); setShowSendViaDropdown(false); }}
                                                        >
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <Ionicons name="chatbubble-outline" size={16} color="#374151" />
                                                                <Text style={{ marginLeft: 8, color: '#374151' }}>SMS Message</Text>
                                                            </View>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[modalStyles.paymentModalDropdownOption, sendVia === 'WhatsApp' && { backgroundColor: '#F3F4F6' }]}
                                                            onPress={() => { setSendVia('WhatsApp'); setShowSendViaDropdown(false); }}
                                                        >
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <Ionicons name="logo-whatsapp" size={16} color="#374151" />
                                                                <Text style={{ marginLeft: 8, color: '#374151' }}>WhatsApp</Text>
                                                            </View>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[modalStyles.paymentModalDropdownOption, sendVia === 'Phone Call' && { backgroundColor: '#F3F4F6' }]}
                                                            onPress={async () => {
                                                                setShowSendViaDropdown(false);
                                                                const sanitizedPhone = customer.phone.replace(/[^0-9+]/g, '');
                                                                const url = `tel:${sanitizedPhone}`;
                                                                Linking.openURL(url).catch(() => {
                                                                    showToast('Phone calls are not available on this device');
                                                                });
                                                                onClose();
                                                                return;
                                                            }}
                                                        >
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <Ionicons name="call-outline" size={16} color="#374151" />
                                                                <Text style={{ marginLeft: 8, color: '#374151' }}>Phone Call</Text>
                                                            </View>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Message */}
                                            <View style={{ marginBottom: 20 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <Text style={modalStyles.paymentModalLabel}>Message</Text>
                                                    <TouchableOpacity
                                                        style={modalStyles.paymentTemplateBtn}
                                                        onPress={() => {
                                                            const name = customer?.name || 'Customer';
                                                            if (requestType === 'Payment Due Reminder') {
                                                                const amount = Math.abs(customer?.balance || 0).toFixed(2);
                                                                const month = customer?.serviceMonth || 'this month';
                                                                const template = `Dear ${name},\n\nYou have a pending payment of ₹${amount} for your delivery service in ${month}.\n\nPlease make the payment at your earliest convenience.\n\nThank you!`;
                                                                setReminderMessage(template);
                                                            } else if (requestType === 'Advance Payment Request') {
                                                                const amount = advanceAmount || '0.00';
                                                                const reason = (advanceReason && advanceReason.trim()) ? advanceReason : 'your order';
                                                                const template = `Dear ${name},\n\nThis is a request for an advance payment of ₹${amount} for ${reason}.\n\nPlease complete the payment to proceed with your request.\n\nThank you!`;
                                                                setReminderMessage(template);
                                                            }
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 11, color: '#4B5563', fontWeight: '500' }}>Use Template</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <TextInput
                                                    style={modalStyles.paymentMessageInput}
                                                    placeholder="Enter your reminder message..."
                                                    placeholderTextColor="#9CA3AF"
                                                    multiline
                                                    numberOfLines={3}
                                                    value={reminderMessage}
                                                    onChangeText={setReminderMessage}
                                                    textAlignVertical="top"
                                                    maxLength={500}
                                                />
                                            </View>

                                            {/* Schedule Options */}
                                            <View style={{ marginBottom: 20 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Schedule Options</Text>

                                                <View style={{ marginBottom: 12 }}>
                                                    <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Date (Optional)</Text>
                                                    <TouchableOpacity
                                                        style={modalStyles.paymentModalDropdown}
                                                        onPress={() => setShowScheduleDatePicker(true)}
                                                    >
                                                        <Text style={{ color: scheduleDate ? '#111827' : '#9CA3AF' }}>
                                                            {scheduleDate ? scheduleDate.toLocaleDateString() : 'dd-mm-yyyy'}
                                                        </Text>
                                                        <Ionicons name="calendar-outline" size={18} color="#111827" />
                                                    </TouchableOpacity>
                                                </View>

                                                <View>
                                                    <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Time (Optional)</Text>
                                                    <TouchableOpacity
                                                        style={modalStyles.paymentModalDropdown}
                                                        onPress={() => setShowScheduleTimePicker(true)}
                                                    >
                                                        <Text style={{ color: scheduleTime ? '#111827' : '#9CA3AF' }}>
                                                            {scheduleTime ? scheduleTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                        </Text>
                                                        <Ionicons name="time-outline" size={18} color="#111827" />
                                                    </TouchableOpacity>
                                                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Leave empty to send immediately</Text>
                                                </View>

                                                {showScheduleDatePicker && (
                                                    <DateTimePicker
                                                        value={scheduleDate || new Date()}
                                                        mode="date"
                                                        display="default"
                                                        onChange={(event, selectedDate) => {
                                                            setShowScheduleDatePicker(false);
                                                            if (selectedDate) setScheduleDate(selectedDate);
                                                        }}
                                                    />
                                                )}
                                                {showScheduleTimePicker && (
                                                    <DateTimePicker
                                                        value={scheduleTime || new Date()}
                                                        mode="time"
                                                        display="default"
                                                        onChange={(event, selectedTime) => {
                                                            setShowScheduleTimePicker(false);
                                                            if (selectedTime) setScheduleTime(selectedTime);
                                                        }}
                                                    />
                                                )}
                                            </View>

                                            {/* Send Button */}
                                            <TouchableOpacity
                                                style={[modalStyles.paymentSendBtn, { backgroundColor: '#2563EB', opacity: isSending ? 0.7 : 1 }]}
                                                onPress={async () => {
                                                    if (isSending) return;
                                                    if (!reminderMessage.trim() && requestType === 'Payment Due Reminder') {
                                                        showToast('Please enter a message', 'error');
                                                        return;
                                                    }
                                                    if (requestType === 'Advance Payment Request' && !advanceAmount) {
                                                        showToast('Please enter an amount', 'error');
                                                        return;
                                                    }

                                                    setIsSending(true);
                                                    try {
                                                        const payload = {
                                                            title: requestType,
                                                            body: reminderMessage,
                                                            method: sendVia,
                                                            amount: requestType === 'Advance Payment Request' ? advanceAmount : Math.abs(customer.balance),
                                                            purpose: requestType === 'Advance Payment Request' ? advanceReason : 'Payment Due',
                                                            scheduled_for: scheduleDate ? `${scheduleDate.toISOString().split('T')[0]} ${scheduleTime ? scheduleTime.toLocaleTimeString([], { hour12: false }) : '10:00:00'}` : null
                                                        };

                                                        if (sendVia === 'WhatsApp') {
                                                            let phoneString = customer.phone.replace(/[^0-9]/g, '');
                                                            if (phoneString.length === 10) phoneString = '91' + phoneString;
                                                            const url = `whatsapp://send?phone=${phoneString}&text=${encodeURIComponent(reminderMessage)}`;
                                                            await Linking.openURL(url).catch(() => Linking.openURL(`https://wa.me/${phoneString}?text=${encodeURIComponent(reminderMessage)}`));
                                                        } else if (sendVia === 'SMS Message') {
                                                            const url = Platform.OS === 'ios'
                                                                ? `sms:${customer.phone}&body=${encodeURIComponent(reminderMessage)}`
                                                                : `sms:${customer.phone}?body=${encodeURIComponent(reminderMessage)}`;
                                                            await Linking.openURL(url);
                                                        }

                                                        await activeAPI.notifyPayment(customer.shop_id, customer.id, payload);
                                                        showToast('Notification request logged successfully');
                                                        fetchHistory();
                                                        onClose();
                                                    } catch (error) {
                                                        showToast(getAPIErrorMessage(error), 'error');
                                                    } finally {
                                                        setIsSending(false);
                                                    }
                                                }}
                                            >
                                                {isSending ? (
                                                    <ActivityIndicator color="#fff" size="small" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="paper-plane" size={18} color="#fff" />
                                                        <Text style={modalStyles.paymentSendBtnText}>Send Notification</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    ) : paymentRequestTab === 'autoSetup' ? (
                                        <View style={modalStyles.paymentTabContent}>
                                            <Text style={modalStyles.paymentModalSectionTitle}>Automatic Reminders</Text>

                                            <View style={{ backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                                                <View style={{ flex: 1, paddingRight: 16 }}>
                                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 }}>Enable Auto Reminders</Text>
                                                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Automatically send reminders when payment is overdue</Text>
                                                </View>
                                                <Switch
                                                    trackColor={{ false: "#E5E7EB", true: "#D1FAE5" }}
                                                    thumbColor={isAutoReminderEnabled ? "#059669" : "#fff"}
                                                    ios_backgroundColor="#E5E7EB"
                                                    onValueChange={() => setIsAutoReminderEnabled(previousState => !previousState)}
                                                    value={isAutoReminderEnabled}
                                                />
                                            </View>

                                            {/* Auto Reminder Message */}
                                            {isAutoReminderEnabled && (
                                                <View style={{ marginBottom: 20 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <Text style={modalStyles.paymentModalLabel}>Default Auto Message</Text>
                                                        <TouchableOpacity
                                                            style={modalStyles.paymentTemplateBtn}
                                                            onPress={() => updateAutoTemplate(null, null, null)}
                                                        >
                                                            <Text style={{ fontSize: 11, color: '#4B5563', fontWeight: '500' }}>Use Template</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <TextInput
                                                        style={modalStyles.paymentMessageInput}
                                                        placeholder="Enter your reminder message..."
                                                        placeholderTextColor="#9CA3AF"
                                                        multiline
                                                        numberOfLines={3}
                                                        value={autoReminderMessage}
                                                        onChangeText={setAutoReminderMessage}
                                                        textAlignVertical="top"
                                                        maxLength={500}
                                                    />
                                                </View>
                                            )}

                                            {isAutoReminderEnabled && (
                                                <View style={{ marginBottom: 20 }}>
                                                    {/* Send reminder after */}
                                                    <View style={{ marginBottom: 16, zIndex: 30 }}>
                                                        <Text style={modalStyles.paymentModalLabel}>Send reminder after</Text>
                                                        <TouchableOpacity
                                                            style={modalStyles.paymentModalDropdown}
                                                            onPress={() => setShowAutoReminderDelayDropdown(!showAutoReminderDelayDropdown)}
                                                        >
                                                            <Text style={{ color: '#111827' }}>{autoReminderDelay}</Text>
                                                            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                                                        </TouchableOpacity>

                                                        {showAutoReminderDelayDropdown && (
                                                            <View style={modalStyles.paymentModalDropdownOptions}>
                                                                {['1 day overdue', '3 days overdue', '7 days overdue', '15 days overdue', '30 days overdue'].map((option) => (
                                                                    <TouchableOpacity
                                                                        key={option}
                                                                        style={[
                                                                            modalStyles.paymentModalDropdownOption,
                                                                            autoReminderDelay === option && { backgroundColor: '#F3F4F6' }
                                                                        ]}
                                                                        onPress={() => {
                                                                            setAutoReminderDelay(option);
                                                                            setShowAutoReminderDelayDropdown(false);
                                                                            updateAutoTemplate(option, null, null);
                                                                        }}
                                                                    >
                                                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                            <Text style={{ color: '#374151', fontSize: 14 }}>{option}</Text>
                                                                            {autoReminderDelay === option && (
                                                                                <Ionicons name="checkmark-sharp" size={16} color="#374151" />
                                                                            )}
                                                                        </View>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </View>
                                                        )}
                                                    </View>

                                                    {/* Reminder Frequency */}
                                                    <View style={{ marginBottom: 16, zIndex: 20 }}>
                                                        <Text style={modalStyles.paymentModalLabel}>Reminder Frequency</Text>
                                                        <TouchableOpacity
                                                            style={modalStyles.paymentModalDropdown}
                                                            onPress={() => setShowAutoReminderFrequencyDropdown(!showAutoReminderFrequencyDropdown)}
                                                        >
                                                            <Text style={{ color: '#111827' }}>{autoReminderFrequency}</Text>
                                                            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                                                        </TouchableOpacity>

                                                        {showAutoReminderFrequencyDropdown && (
                                                            <View style={modalStyles.paymentModalDropdownOptions}>
                                                                {['Send once only', 'Daily until paid', 'Weekly until paid', 'Every 2 weeks'].map((option) => (
                                                                    <TouchableOpacity
                                                                        key={option}
                                                                        style={[
                                                                            modalStyles.paymentModalDropdownOption,
                                                                            autoReminderFrequency === option && { backgroundColor: '#F3F4F6' }
                                                                        ]}
                                                                        onPress={() => {
                                                                            setAutoReminderFrequency(option);
                                                                            setShowAutoReminderFrequencyDropdown(false);
                                                                            updateAutoTemplate(null, option, null);
                                                                        }}
                                                                    >
                                                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                            <Text style={{ color: '#374151', fontSize: 14 }}>{option}</Text>
                                                                            {autoReminderFrequency === option && (
                                                                                <Ionicons name="checkmark-sharp" size={16} color="#374151" />
                                                                            )}
                                                                        </View>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </View>
                                                        )}
                                                    </View>

                                                    {/* Auto Reminder Method */}
                                                    <View style={{ marginBottom: 16, zIndex: 10 }}>
                                                        <Text style={modalStyles.paymentModalLabel}>Auto Reminder Method</Text>
                                                        <TouchableOpacity
                                                            style={modalStyles.paymentModalDropdown}
                                                            onPress={() => setShowAutoReminderMethodDropdown(!showAutoReminderMethodDropdown)}
                                                        >
                                                            <Text style={{ color: '#111827' }}>{autoReminderMethod}</Text>
                                                            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                                                        </TouchableOpacity>

                                                        {showAutoReminderMethodDropdown && (
                                                            <View style={modalStyles.paymentModalDropdownOptions}>
                                                                {['Push Notification', 'SMS Message', 'WhatsApp'].map((option) => (
                                                                    <TouchableOpacity
                                                                        key={option}
                                                                        style={[
                                                                            modalStyles.paymentModalDropdownOption,
                                                                            autoReminderMethod === option && { backgroundColor: '#F3F4F6' }
                                                                        ]}
                                                                        onPress={() => {
                                                                            setAutoReminderMethod(option);
                                                                            setShowAutoReminderMethodDropdown(false);
                                                                            updateAutoTemplate(null, null, option);
                                                                        }}
                                                                    >
                                                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                            <Text style={{ color: '#374151', fontSize: 14 }}>{option}</Text>
                                                                            {autoReminderMethod === option && (
                                                                                <Ionicons name="checkmark-sharp" size={16} color="#374151" />
                                                                            )}
                                                                        </View>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                            )}


                                            <TouchableOpacity
                                                disabled={isSaving}
                                                onPress={async () => {
                                                    setIsSaving(true);
                                                    try {
                                                        const updateData = {
                                                            is_auto_reminder_enabled: isAutoReminderEnabled,
                                                            auto_reminder_delay: autoReminderDelay,
                                                            auto_reminder_frequency: autoReminderFrequency,
                                                            auto_reminder_method: autoReminderMethod,
                                                            auto_reminder_message: autoReminderMessage
                                                        };
                                                        await activeAPI.update(customer.shop_id, customer.id, updateData);
                                                        showToast('Auto reminder settings saved successfully!');
                                                    } catch (error) {
                                                        const errorMsg = error.response?.data?.detail || 'Failed to save settings';
                                                        showToast(errorMsg);
                                                    } finally {
                                                        setIsSaving(false);
                                                    }
                                                }}
                                            >
                                                <LinearGradient
                                                    colors={isSaving ? ['#9CA3AF', '#6B7280'] : ['#111827', '#374151']}
                                                    style={modalStyles.paymentSendBtn}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                >
                                                    {isSaving ? (
                                                        <ActivityIndicator color="#fff" size="small" />
                                                    ) : (
                                                        <Text style={modalStyles.paymentSendBtnText}>Save Auto Reminder Settings</Text>
                                                    )}
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={modalStyles.paymentTabContent}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                                <Text style={modalStyles.paymentModalSectionTitle}>Reminders History</Text>
                                                <TouchableOpacity onPress={fetchHistory}>
                                                    <Ionicons name="refresh-outline" size={18} color="#4B5563" />
                                                </TouchableOpacity>
                                            </View>

                                            {loadingHistory ? (
                                                <View style={{ padding: 40, alignItems: 'center' }}>
                                                    <ActivityIndicator size="small" color="#2563EB" />
                                                    <Text style={{ marginTop: 10, color: '#6B7280', fontSize: 12 }}>Loading history...</Text>
                                                </View>
                                            ) : notiHistory.length === 0 ? (
                                                <View style={{ padding: 40, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12 }}>
                                                    <Ionicons name="mail-unread-outline" size={40} color="#D1D5DB" />
                                                    <Text style={{ marginTop: 10, color: '#6B7280', fontSize: 13, textAlign: 'center' }}>No reminders sent yet.</Text>
                                                </View>
                                            ) : (
                                                notiHistory.slice(0, 10).map((item, index) => (
                                                    <View key={item.id || index} style={{
                                                        backgroundColor: '#fff',
                                                        borderWidth: 1,
                                                        borderColor: '#F3F4F6',
                                                        borderRadius: 12,
                                                        padding: 12,
                                                        marginBottom: 10,
                                                        flexDirection: 'row',
                                                        alignItems: 'center'
                                                    }}>
                                                        <View style={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 16,
                                                            backgroundColor: item.method === 'Push Notification' ? '#DBEAFE' : '#D1FAE5',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            marginRight: 12
                                                        }}>
                                                            <Ionicons
                                                                name={item.method === 'Push Notification' ? 'notifications-outline' : 'chatbubble-outline'}
                                                                size={16}
                                                                color={item.method === 'Push Notification' ? '#2563EB' : '#059669'}
                                                            />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{item.title || 'Payment Reminder'}</Text>
                                                                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{formatShortDate(item.created_at)}</Text>
                                                            </View>
                                                            <Text style={{ fontSize: 12, color: '#6B7280' }} numberOfLines={1}>{item.body || item.message}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                                <Text style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>{item.method}</Text>
                                                                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB', marginHorizontal: 6 }} />
                                                                <Text style={{ fontSize: 10, color: item.status === 'sent' ? '#059669' : '#EF4444', fontWeight: '600' }}>{item.status || 'sent'}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
            {renderToast()}
        </Modal>
    );
};

const modalStyles = StyleSheet.create({
    paymentModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    paymentModalContent: {
        backgroundColor: '#F3F4F6',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    paymentModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    paymentModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 10,
    },
    paymentCustomerCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    },
    cardLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
        fontWeight: '500',
    },
    cardValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '700',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    paymentModalTabs: {
        flexDirection: 'row',
        backgroundColor: '#E5E7EB',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    paymentModalTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    paymentModalTabActive: {
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    paymentModalTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    paymentModalTabTextActive: {
        color: '#111827',
    },
    paymentMainCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 60,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    paymentTabContent: {
        // Wrapper for content inside the main card
    },
    paymentModalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    paymentModalDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    paymentModalDropdownOptions: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        marginTop: 4,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 4, overflow: 'hidden',
    },
    paymentModalDropdownOption: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    paymentStatusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        gap: 10,
    },
    paymentStatusText: {
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    paymentTemplateBtn: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    paymentMessageInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        minHeight: 120,
    },
    paymentSendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 10,
        gap: 10,
        marginBottom: 40,
    },
    paymentSendBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    paymentModalSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    historyEmptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    historyEmptyText: {
        fontSize: 14, color: '#9CA3AF', marginTop: 12,
    },
    historyItem: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    historyMethod: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    historyMethodText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#374151',
    },
    historyDate: {
        fontSize: 11,
        color: '#6B7280',
    },
    historyMessage: {
        fontSize: 13,
        color: '#4B5563',
        lineHeight: 18,
    },
    historyStatus: {
        marginTop: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#ECFDF5',
    },
    historyStatusText: {
        fontSize: 10,
        color: '#059669',
        fontWeight: '600',
    },
    advanceInfoCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    advanceInputLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    advanceInputWrapper: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    advanceTextInput: {
        fontSize: 15,
        color: '#111827',
    },
    advanceTipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    advanceTipText: {
        fontSize: 12,
        color: '#2563EB',
        lineHeight: 18,
    },
});

export default ServiceDetailScreen;

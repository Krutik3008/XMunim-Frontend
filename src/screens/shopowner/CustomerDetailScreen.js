import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    Alert,
    TextInput,
    Modal,
    Switch,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    TouchableWithoutFeedback,
    Keyboard,
    Animated,
    Share,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { customerAPI, transactionAPI, productAPI, shopAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/ui';
import ShopHeader from '../../components/shopowner/ShopHeader';
import ShopBottomNav from '../../components/shopowner/ShopBottomNav';
import AddTransactionModal from './AddTransactionModal';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { saveFileToDevice } from '../../utils/downloadHelper';

// Shared saveFileToDevice removed - now using utils/downloadHelper.js

const CustomerDetailScreen = ({ route, navigation }) => {
    const { customer: initialCustomer, shopId } = route.params;
    const { user, logout } = useAuth();
    const [customer, setCustomer] = useState(initialCustomer);
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [shopDetails, setShopDetails] = useState(null);

    // Modal
    const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
    const [showPaymentRequestModal, setShowPaymentRequestModal] = useState(false);

    // Filters
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);
    const [showFromDatePicker, setShowFromDatePicker] = useState(false);
    const [showToDatePicker, setShowToDatePicker] = useState(false);
    const [transactionType, setTransactionType] = useState('all');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [toastType, setToastType] = useState('success');
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef(null);

    const showToast = (message, type = 'success') => {
        Keyboard.dismiss();
        if (toastTimer.current) clearTimeout(toastTimer.current);

        let finalType = type;
        if (typeof message === 'string' && message.toLowerCase().includes('network error')) {
            finalType = 'error';
        }

        setToastMessage(message);
        setToastType(finalType);
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
                    <View style={[styles.toastIcon, toastType === 'error' && { backgroundColor: '#EF4444' }]}>
                        <Ionicons name={toastType === 'error' ? "alert-circle" : "checkmark-circle"} size={20} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.toastText, typeof toastMessage === 'string' && (toastMessage.toLowerCase().includes('network error') || toastMessage.toLowerCase().includes('switch failed') || toastMessage.toLowerCase().includes('admin access')) && { paddingHorizontal: 10, flex: 1 }]}>{toastMessage}</Text>
                </View>
            </Animated.View>
        );
    };

    // Edit Customer State
    const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editNickname, setEditNickname] = useState('');
    const [updatingCustomer, setUpdatingCustomer] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [shopId, initialCustomer?.id])
    );

    useEffect(() => {
        applyFilters();
    }, [transactions, dateFrom, dateTo, transactionType]);

    const loadData = async () => {
        setLoading(true);
        try {
            const transactionsRes = await customerAPI.getTransactions(shopId, customer.id);
            const sorted = (transactionsRes.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
            setTransactions(sorted);

            try {
                const shopRes = await shopAPI.getDashboard(shopId);
                setShopDetails(shopRes.data?.shop);
            } catch (e) {
                showToast('Failed to load shop details', e);
            }

            const productsRes = await productAPI.getAll(shopId);
            setProducts(productsRes.data?.filter(p => p.active) || []);

            try {
                const customersRes = await customerAPI.getAll(shopId);
                const custData = customersRes.data || {};
                const customersList = custData.customers || custData || [];
                const updatedCustomer = customersList.find(c => c.id === customer.id);
                if (updatedCustomer) {
                    setCustomer(updatedCustomer);
                }
            } catch (e) {
                showToast('Failed to refresh customer', e);
            }
        } catch (error) {
            showToast(`Load data error: ${error.message || 'Network Error'}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...transactions];

        if (dateFrom) {
            const fromStart = new Date(dateFrom);
            fromStart.setHours(0, 0, 0, 0);
            filtered = filtered.filter(t => new Date(t.date) >= fromStart);
        }
        if (dateTo) {
            const toEnd = new Date(dateTo);
            toEnd.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => new Date(t.date) <= toEnd);
        }
        if (transactionType !== 'all') {
            if (transactionType === 'credit') {
                filtered = filtered.filter(t => t.type === 'credit' || t.type === 'DEBIT');
            } else if (transactionType === 'payment') {
                filtered = filtered.filter(t => t.type === 'payment' || t.type === 'CREDIT' || t.type === 'debit');
            }
        }

        setFilteredTransactions(filtered);
        calculateStats(filtered);
    };

    const formatShortDate = (dateString) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return "Invalid Date";
            return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
        } catch (e) {
            return dateString || "";
        }
    };

    const formatTime = (dateString) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return "";
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
        } catch (e) {
            return "";
        }
    };

    const formatDateDisplay = (date) => {
        if (!date) return '';
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const exportToPDF = async () => {
        try {
            const now = new Date();
            const generatedDate = `${now.toLocaleDateString('en-GB')} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

            const txRows = filteredTransactions.map(t => {
                const isPay = t.type === 'debit' || t.type === 'payment' || t.type === 'CREDIT';
                const items = t.products || t.items || [];
                const itemNames = items.map(i => i.name || 'Item').join(', ') || '-';
                const totalQty = items.reduce((s, i) => s + (i.quantity || 1), 0);
                const typeColor = isPay ? '#10B981' : '#DC2626';
                const typeLabel = isPay ? 'Payment Received' : 'Credit Given';
                const amountColor = isPay ? '#10B981' : '#DC2626';
                return `<tr>
                    <td>${formatShortDate(t.date)}<br/><span style="font-size:9px;color:#6B7280">${formatTime(t.date)}</span></td>
                    <td style="color:${typeColor};font-weight:600">${typeLabel}</td>
                    <td>${itemNames}</td>
                    <td>${items.length > 0 ? totalQty : '-'}</td>
                    <td style="color:${amountColor};font-weight:600">₹${parseFloat(t.amount || 0).toFixed(2)}</td>
                    <td>${t.note || t.notes || '-'}</td>
                </tr>`;
            }).join('');

            const html = `
            <html><head><style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111827; font-size: 12px; }
                .header { text-align: center; margin-bottom: 24px; }
                .header h1 { font-size: 20px; color: #111827; margin-bottom: 6px; }
                .badge { display: inline-block; background: #DC2626; color: #fff; font-size: 9px; padding: 3px 10px; border-radius: 4px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 4px; }
                .generated { color: #6B7280; font-size: 11px; margin-top: 4px; }
                .section { background: #F9FAFB; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
                .info-row { margin-bottom: 4px; font-size: 12px; color: #374151; }
                .analytics { display: flex; gap: 12px; margin-bottom: 20px; }
                .analytics-box { flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; text-align: center; background: #fff; }
                .green { color: #10B981; }
                .red { color: #DC2626; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #F9FAFB; color: #6B7280; padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; border-bottom: 2px solid #E5E7EB; }
                td { padding: 10px 8px; border-bottom: 1px solid #F3F4F6; font-size: 11px; }
            </style></head><body>
                <div class="header">
                    <h1>Customer Transaction Report</h1>
                    <div class="generated">${dateFrom || dateTo ? `Period: ${dateFrom ? formatDateDisplay(dateFrom) : 'Beginning'} to ${dateTo ? formatDateDisplay(dateTo) : 'Today'}` : 'Period: Full History'}</div>
                    <div class="generated">Generated on: ${generatedDate}</div>
                </div>
                ${shopDetails ? `
                <div class="section">
                    <div style="font-weight: bold; margin-bottom: 6px; color: #D97706;">Shop Information</div>
                    <div class="info-row"><b>Shop Name:</b> ${shopDetails.name}</div>
                    <div class="info-row"><b>Location:</b> ${shopDetails.location || 'N/A'}</div>
                </div>
                ` : ''}
                <div class="section">
                    <div style="font-weight: bold; margin-bottom: 6px; color: #D97706;">Customer Information</div>
                    <div class="info-row"><b>Customer Name:</b> ${customer.name}</div>
                    <div class="info-row"><b>Phone:</b> +91 ${customer.phone}</div>
                </div>
                <table>
                    <tr><th>Date</th><th>Type</th><th>Items</th><th>Qty</th><th>Amount</th><th>Note</th></tr>
                    ${txRows}
                </table>
            </body></html>`;

            const { uri } = await Print.printToFileAsync({ html });
            const fileName = `${customer.name}_${shopDetails?.name || 'Shop'}.pdf`;
            const fileUri = FileSystem.cacheDirectory + fileName;
            await FileSystem.moveAsync({ from: uri, to: fileUri });

            if (Platform.OS === 'android') {
                const base64Content = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
                const result = await saveFileToDevice(fileName, base64Content, 'application/pdf');
                if (result.success) {
                    showToast('Download Successful');
                }
            } else {
                // iOS: save to app's document directory via helper
                const base64Content = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
                const result = await saveFileToDevice(fileName, base64Content, 'application/pdf');
                if (result.success) {
                    showToast('Download Successful');
                }
            }
        } catch (error) {
            console.error('PDF export error:', error);
            showToast('Failed to generate PDF');
        }
    };

    const exportToExcel = async () => {
        try {
            const rows = [];

            // Add Header Info
            rows.push(['Customer Transaction Report']);
            rows.push([`Shop: ${shopDetails?.name || 'N/A'}`]);
            rows.push([`Category: ${shopDetails?.category || 'N/A'}`]);
            rows.push([`Location: ${shopDetails?.location || 'N/A'}`]);
            rows.push([`Shop Code: ${shopDetails?.shop_code || 'N/A'}`]);
            rows.push([]);
            rows.push([`Customer: ${customer.name} (${customer.phone || 'N/A'})`]);
            rows.push([`Period: ${dateFrom || dateTo ? `${dateFrom ? formatDateDisplay(dateFrom) : 'Beginning'} to ${dateTo ? formatDateDisplay(dateTo) : 'Today'}` : 'Full History'}`]);
            rows.push([]); // Empty spacing row

            // Add Table Headers
            rows.push(['Date', 'Type', 'Items', 'Quantity', 'Amount', 'Note']);
            filteredTransactions.forEach(t => {
                const isPay = t.type === 'debit' || t.type === 'payment' || t.type === 'CREDIT';
                const items = t.products || t.items || [];
                rows.push([
                    `${formatShortDate(t.date)} ${formatTime(t.date)}`,
                    isPay ? 'Payment Received' : 'Credit Given',
                    items.map(i => i.name).join(', '),
                    items.reduce((s, i) => s + (i.quantity || 1), 0),
                    parseFloat(t.amount || 0),
                    t.note || t.notes || ''
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

            const fileName = `${customer.name}_${shopDetails?.name || 'Shop'}.xlsx`;
            const fileUri = FileSystem.cacheDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: 'base64' });

            if (Platform.OS === 'android') {
                const result = await saveFileToDevice(fileName, wbout, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                if (result.success) {
                    showToast('Download Successful');
                }
            } else {
                // iOS: save to app's document directory via helper
                const result = await saveFileToDevice(fileName, wbout, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                if (result.success) {
                    showToast('Download Successful');
                }
            }
        } catch (error) {
            console.error('Excel export error:', error);
            showToast('Failed to generate Excel');
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleTransactionSuccess = () => {
        loadData();
        showToast('Transaction added successfully');
    };

    const calculateStats = () => {
        const credits = filteredTransactions.filter(t => t.type === 'credit');
        const payments = filteredTransactions.filter(t => t.type === 'debit' || t.type === 'payment');

        const totalCreditsAmount = credits.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalPaymentsAmount = payments.reduce((sum, t) => sum + (t.amount || 0), 0);

        const totalItems = filteredTransactions.reduce((sum, t) => {
            const items = t.products || t.items || [];
            return sum + items.reduce((itemSum, p) => itemSum + (p.quantity || 0), 0);
        }, 0);

        return {
            totalTransactions: filteredTransactions.length,
            totalCredits: credits.length,
            totalPayments: payments.length,
            totalCreditsAmount,
            totalPaymentsAmount,
            totalItems,
            netBalance: totalPaymentsAmount - totalCreditsAmount
        };
    };

    const stats = calculateStats();

    const formatCurrency = (amount) => {
        return `₹${parseFloat(amount || 0).toFixed(2)}`;
    };


    const handleSendUPILink = async () => {
        if (!customer || (customer?.balance || 0) >= 0) {
            showToast('No pending dues for this customer');
            return;
        }

        const shopName = shopDetails?.name || 'Our Shop';
        const upiId = shopDetails?.upi_id || '';
        const phone = customer?.phone;

        if (!phone) {
            showToast('Customer phone number is missing');
            return;
        }

        const amount = Math.abs(customer.balance).toFixed(2);

        // Professional message template with explicit labels
        const message = upiId
            ? `Hello! My shop name is ${shopName}. Your pending payment is ₹${amount}. My UPI ID is ${upiId}. Please pay as soon as possible for a quick settlement. Thank you!`
            : `Hello! My shop name is ${shopName}. Your pending payment is ₹${amount}. Please settle this as soon as possible. Thank you!`;

        try {
            const whatsappUrl = `whatsapp://send?phone=+91${phone}&text=${encodeURIComponent(message)}`;
            const canOpen = await Linking.canOpenURL(whatsappUrl);

            if (canOpen) {
                await Linking.openURL(whatsappUrl);
            } else {
                await Share.share({
                    message: message,
                    title: 'Payment Request'
                });
            }
        } catch (error) {
            console.error('Share error:', error);
            showToast('Failed to share UPI link');
        }
    };

    const handlePaymentRequest = () => {
        setShowPaymentRequestModal(true);
    };

    const getBalanceColor = () => {
        const balance = customer?.balance || 0;
        if (balance < 0) return '#EF4444'; // Red for Owes
        if (balance > 0) return '#10B981'; // Green for Credit
        return '#374151'; // Dark gray for Clear
    };

    const getBalanceLabel = () => {
        const balance = customer?.balance || 0;
        if (balance < 0) return 'Dues';
        if (balance > 0) return 'Credit';
        return 'Clear';
    };

    const getBalanceBgColor = () => {
        const balance = customer?.balance || 0;
        if (balance < 0) return '#EF4444'; // Red background for Due
        if (balance > 0) return '#10B981'; // Green background for Credit
        return '#111827'; // Black for Clear
    };

    const getBalanceTextColor = () => {
        return '#FFF';
    };

    const openEditModal = () => {
        setEditName(customer.name);
        setEditPhone(customer.phone);
        setEditNickname(customer.nickname || '');
        setShowEditCustomerModal(true);
    };

    const handleUpdateCustomer = async () => {
        if (!editName.trim()) {
            showToast('Please enter customer name');
            return;
        }
        if (!editPhone.trim() || editPhone.length !== 10) {
            showToast('Please enter a valid phone number');
            return;
        }

        Keyboard.dismiss();

        setUpdatingCustomer(true);
        try {
            const updateData = {
                name: editName.trim(),
                phone: editPhone.trim(),
                nickname: editNickname.trim() || null
            };

            await customerAPI.update(shopId, customer.id, updateData);

            showToast('Customer updated successfully');
            setShowEditCustomerModal(false);

            // Update local state
            setCustomer(prev => ({ ...prev, ...updateData }));
            // loadData(); // Optional, but local update is faster
        } catch (error) {
            showToast('Failed to update customer', error);
        } finally {
            setUpdatingCustomer(false);
        }
    };

    // Header Component replaced by imported ShopHeader



    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={{ flex: 1 }}>
                {/* Edit Customer Modal */}
                <Modal
                    visible={showEditCustomerModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowEditCustomerModal(false)}
                    statusBarTranslucent={true}
                >
                    <KeyboardAvoidingView
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}
                        behavior="padding"
                    >
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Edit Customer</Text>
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
                            />

                            <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                                Phone <Text style={{ color: '#EF4444' }}>*</Text>
                            </Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 }}
                                value={editPhone}
                                onChangeText={(text) => setEditPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
                                keyboardType="numeric"
                            />

                            <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>Nickname</Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16 }}
                                value={editNickname}
                                onChangeText={setEditNickname}
                                placeholder="Optional"
                            />

                            <TouchableOpacity
                                style={{ backgroundColor: '#3B82F6', padding: 14, borderRadius: 8, alignItems: 'center' }}
                                onPress={handleUpdateCustomer}
                                disabled={updatingCustomer}
                            >
                                {updatingCustomer ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Update Customer</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        {renderToast()}
                    </KeyboardAvoidingView>
                </Modal>

                {/* Header - Same as Dashboard */}
                <ShopHeader />

                <View style={styles.content}>
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollViewContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={() => {
                            setShowTypeDropdown(false);
                            setShowPerPageDropdown(false);
                            Keyboard.dismiss();
                        }}
                    >
                        {/* Back Button + Title Row */}
                        <View style={styles.backRow}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={24} color="#374151" />
                            </TouchableOpacity>
                            <View style={styles.pageTitle}>
                                <Text style={styles.pageTitleText}>Customer Details</Text>
                                <Text style={styles.pageSubtitle}>Transaction history and management</Text>
                            </View>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={openEditModal} style={{ padding: 8 }}>
                                <Ionicons name="create-outline" size={24} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>

                        {/* Customer Info Card */}
                        <View style={styles.customerCard}>
                            <View style={styles.customerLeft}>
                                <Text style={styles.customerName}>
                                    {customer?.name || 'Unknown'}
                                    {customer?.nickname ? ` (${customer.nickname})` : ''}
                                </Text>
                                <Text style={styles.customerPhone}>+91 {customer?.phone || 'N/A'}</Text>
                                <View style={styles.customerBalanceRow}>
                                    <View style={[styles.balanceBadge, { backgroundColor: getBalanceBgColor() }]}>
                                        <Text style={[styles.balanceBadgeText, { color: getBalanceTextColor() }]}>
                                            {getBalanceLabel()}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[styles.balanceAmount, { color: getBalanceColor() }]}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit={true}
                                        minimumFontScale={0.5}
                                    >
                                        {customer?.balance !== 0 ? (customer?.balance > 0 ? '+' : '-') : ''}{formatCurrency(Math.abs(customer?.balance || 0))}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Add Transaction Button */}
                        <TouchableOpacity
                            onPress={() => setShowAddTransactionModal(true)}
                            onPressIn={() => { }} // For touch feedback
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#2563EB']}
                                style={styles.addTransactionBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Ionicons name="add" size={20} color="#fff" />
                                <Text style={styles.addTransactionText}>Add Transaction</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Send UPI Link Button */}
                        <TouchableOpacity style={styles.sendUpiBtn} onPress={handleSendUPILink}>
                            <Ionicons name="phone-portrait-outline" size={18} color="#111827" />
                            <Text style={styles.sendUpiBtnText}>Send UPI Link</Text>
                        </TouchableOpacity>

                        {/* Payment Request Button */}
                        <TouchableOpacity
                            onPress={handlePaymentRequest}
                        >
                            <LinearGradient
                                colors={['#F97316', '#EF4444']}
                                style={styles.paymentRequestBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Ionicons name="time-outline" size={18} color="#fff" />
                                <Text style={styles.paymentRequestText}>Payment Request</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Loading State */}
                        {loading ? (
                            <View style={{ paddingBottom: 20 }}>
                                {/* Analytics Skeleton */}
                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Skeleton width="40%" height={18} />
                                    </View>
                                    <View style={styles.statsGrid}>
                                        {[1, 2, 3, 4].map(i => (
                                            <View key={i} style={[styles.statBox, { backgroundColor: '#F3F4F6' }]}>
                                                <Skeleton width="50%" height={24} style={{ marginBottom: 8 }} />
                                                <Skeleton width="70%" height={12} />
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                {/* Transactions Skeleton */}
                                {[1, 2, 3].map(i => (
                                    <View key={i} style={[styles.sectionCard, { padding: 16 }]}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <Skeleton width="30%" height={14} />
                                            <Skeleton width="20%" height={14} />
                                        </View>
                                        <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
                                        <Skeleton width="40%" height={14} />
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <>
                                {/* Purchase Analytics Section */}
                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="bar-chart-outline" size={18} color="#374151" />
                                        <Text style={styles.sectionTitle}>Purchase Analytics</Text>
                                    </View>

                                    <View style={styles.statsGrid}>
                                        <View style={[styles.statBox, { backgroundColor: '#EFF6FF' }]}>
                                            <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.totalTransactions}</Text>
                                            <Text style={styles.statLabel}>Total Transactions</Text>
                                        </View>
                                        <View style={[styles.statBox, { backgroundColor: '#FEE2E2' }]}>
                                            <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.totalCredits}</Text>
                                            <Text style={styles.statLabel}>Credits Given</Text>
                                            <Text style={[styles.statSubValue, { color: '#EF4444' }]}>{formatCurrency(stats.totalCreditsAmount)}</Text>
                                        </View>
                                        <View style={[styles.statBox, { backgroundColor: '#D1FAE5' }]}>
                                            <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.totalPayments}</Text>
                                            <Text style={styles.statLabel}>Payments Received</Text>
                                            <Text style={[styles.statSubValue, { color: '#10B981' }]}>{formatCurrency(stats.totalPaymentsAmount)}</Text>
                                        </View>
                                        <View style={[styles.statBox, { backgroundColor: '#F3E8FF' }]}>
                                            <Text style={[styles.statValue, { color: '#7C3AED' }]}>{stats.totalItems}</Text>
                                            <Text style={styles.statLabel}>Items Purchased</Text>
                                        </View>
                                    </View>

                                    <View style={styles.netBalanceRow}>
                                        <Text style={styles.netBalanceLabel}>Net Transaction Balance:</Text>
                                        <View style={styles.netBalanceRight}>
                                            <Text style={[styles.netBalanceValue, { color: stats.netBalance > 0 ? '#10B981' : (stats.netBalance < 0 ? '#EF4444' : '#111827') }]}>
                                                {stats.netBalance > 0 ? '+' : (stats.netBalance < 0 ? '-' : '')}{formatCurrency(Math.abs(stats.netBalance))}
                                            </Text>
                                            <Text style={[styles.netBalanceStatus, { color: stats.netBalance > 0 ? '#10B981' : (stats.netBalance < 0 ? '#EF4444' : '#111827') }]}>
                                                {stats.netBalance > 0 ? 'Credit' : (stats.netBalance < 0 ? 'Dues' : 'Clear')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Filters & Export Section */}
                                <View style={[styles.sectionCard, { zIndex: 10 }]}>
                                    <View style={styles.filterHeader}>
                                        <View style={styles.filterTitleRow}>
                                            <Ionicons name="filter-outline" size={18} color="#374151" />
                                            <Text style={styles.sectionTitle}>Filters & Export</Text>
                                        </View>
                                        <View style={styles.exportButtons}>
                                            <TouchableOpacity style={styles.pdfBtn} onPress={exportToPDF}>
                                                <Ionicons name="document-text-outline" size={14} color="#EF4444" />
                                                <Text style={styles.pdfBtnText}>PDF</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.excelBtn} onPress={exportToExcel}>
                                                <Ionicons name="grid-outline" size={14} color="#10B981" />
                                                <Text style={styles.excelBtnText}>Excel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.dateFiltersRow}>
                                        <View style={styles.dateFilterItem}>
                                            <Text style={styles.filterLabel}>From Date</Text>
                                            <TouchableOpacity
                                                style={styles.dateInputContainer}
                                                onPress={() => setShowFromDatePicker(true)}
                                            >
                                                <Text style={[styles.dateInput, !dateFrom && { color: '#9CA3AF' }]}>
                                                    {dateFrom ? formatDateDisplay(dateFrom) : 'dd-mm-yyyy'}
                                                </Text>
                                                <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.dateFilterItem}>
                                            <Text style={styles.filterLabel}>To Date</Text>
                                            <TouchableOpacity
                                                style={styles.dateInputContainer}
                                                onPress={() => setShowToDatePicker(true)}
                                            >
                                                <Text style={[styles.dateInput, !dateTo && { color: '#9CA3AF' }]}>
                                                    {dateTo ? formatDateDisplay(dateTo) : 'dd-mm-yyyy'}
                                                </Text>
                                                <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={[styles.typeFilterContainer, { zIndex: 20 }]}>
                                        <Text style={styles.filterLabel}>Transaction Type</Text>
                                        <TouchableOpacity
                                            style={styles.typeDropdown}
                                            onPress={() => setShowTypeDropdown(!showTypeDropdown)}
                                        >
                                            <Text style={styles.typeDropdownText}>
                                                {transactionType === 'all' ? 'All Transactions' : transactionType === 'credit' ? 'Credits Only' : 'Payments Only'}
                                            </Text>
                                            <Ionicons name={showTypeDropdown ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" />
                                        </TouchableOpacity>

                                        {showTypeDropdown && (
                                            <View style={styles.customerDetailDropdownOptions}>
                                                <TouchableOpacity
                                                    style={[styles.customerDetailDropdownOption, transactionType === 'all' && styles.customerDetailDropdownOptionActive]}
                                                    onPress={() => { setTransactionType('all'); setShowTypeDropdown(false); }}
                                                >
                                                    <Text style={[styles.customerDetailDropdownOptionText, transactionType === 'all' && styles.customerDetailDropdownOptionTextActive]}>All Transactions</Text>
                                                    {transactionType === 'all' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.customerDetailDropdownOption, transactionType === 'credit' && styles.customerDetailDropdownOptionActive]}
                                                    onPress={() => { setTransactionType('credit'); setShowTypeDropdown(false); }}
                                                >
                                                    <Text style={[styles.customerDetailDropdownOptionText, transactionType === 'credit' && styles.customerDetailDropdownOptionTextActive]}>Credits Only</Text>
                                                    {transactionType === 'credit' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.customerDetailDropdownOption, transactionType === 'payment' && styles.customerDetailDropdownOptionActive]}
                                                    onPress={() => { setTransactionType('payment'); setShowTypeDropdown(false); }}
                                                >
                                                    <Text style={[styles.customerDetailDropdownOptionText, transactionType === 'payment' && styles.customerDetailDropdownOptionTextActive]}>Payments Only</Text>
                                                    {transactionType === 'payment' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Detailed Transaction History */}
                                <View style={styles.historySection}>
                                    <Text style={styles.historyTitle}>Detailed Transaction History</Text>

                                    {filteredTransactions.length === 0 ? (
                                        <View style={styles.emptyState}>
                                            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                                            <Text style={styles.emptyText}>No transactions found</Text>
                                        </View>
                                    ) : (
                                        (() => {
                                            const totalItems = filteredTransactions.length;
                                            const totalPages = Math.ceil(totalItems / perPage);
                                            const startIdx = (currentPage - 1) * perPage;
                                            const endIdx = Math.min(startIdx + perPage, totalItems);
                                            const paginatedTx = filteredTransactions.slice(startIdx, endIdx);

                                            return (
                                                <>
                                                    {paginatedTx.map((transaction) => {
                                                        const isPayment = transaction.type === 'debit' || transaction.type === 'payment';
                                                        const items = transaction.products || transaction.items || [];

                                                        return (
                                                            <View key={transaction.id} style={styles.transactionCard}>
                                                                <View style={styles.txHeader}>
                                                                    <View style={[styles.txBadge, { backgroundColor: isPayment ? '#000' : '#EF4444' }]}>
                                                                        <Text style={styles.txBadgeText}>{isPayment ? 'Payment' : 'Purchase'}</Text>
                                                                    </View>
                                                                    <View style={styles.txAmountSection}>
                                                                        <Text style={[styles.txAmount, { color: isPayment ? '#10B981' : '#EF4444' }]}>
                                                                            {`${isPayment ? '+' : '-'}\u20b9${parseFloat(transaction.amount || 0).toFixed(2)}`}
                                                                        </Text>
                                                                        <Text style={styles.txAmountLabel}>Amount {isPayment ? 'paid' : 'Dues'}</Text>
                                                                    </View>
                                                                </View>

                                                                <View style={styles.txDateRow}>
                                                                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                                                                    <Text style={styles.txDate}>{formatShortDate(transaction.date)}</Text>
                                                                </View>

                                                                {isPayment && (
                                                                    <View style={styles.txNoteBox}>
                                                                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                                                        <Text style={styles.txNoteText}> Payment received - Balance updated</Text>
                                                                    </View>
                                                                )}

                                                                {items.length > 0 && (
                                                                    <View style={styles.itemsSection}>
                                                                        <View style={styles.itemsHeader}>
                                                                            <Ionicons name="cube-outline" size={14} color="#374151" />
                                                                            <Text style={styles.itemsTitle}> Items Purchased:</Text>
                                                                        </View>
                                                                        {items.map((item, idx) => (
                                                                            <View key={idx} style={styles.itemRow}>
                                                                                <View style={styles.itemInfo}>
                                                                                    <Text style={styles.itemName}>{item.name || 'Item'}</Text>
                                                                                    <Text style={styles.itemPrice}>@ {formatCurrency(item.price || 0)} each</Text>
                                                                                </View>
                                                                                <View style={styles.itemQtySection}>
                                                                                    <Text style={styles.itemQty}>Qty: {item.quantity || 1}</Text>
                                                                                    <Text style={styles.itemSubtotal}>{formatCurrency(item.subtotal || (item.price || 0) * (item.quantity || 1))}</Text>
                                                                                </View>
                                                                            </View>
                                                                        ))}
                                                                        <View style={styles.itemsTotalRow}>
                                                                            <Text style={styles.itemsTotalLabel}>Total Items: {items.reduce((sum, i) => sum + (i.quantity || 1), 0)}</Text>
                                                                            <Text style={styles.itemsTotalValue}>Subtotal: {formatCurrency(items.reduce((sum, i) => sum + (i.subtotal || (i.price || 0) * (i.quantity || 1)), 0))}</Text>
                                                                        </View>
                                                                    </View>
                                                                )}

                                                                {transaction.note ? (
                                                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF9E6', borderLeftWidth: 3, borderLeftColor: '#F59E0B', borderRadius: 8, padding: 10, marginTop: 8, gap: 6 }}>
                                                                        <Text style={{ fontSize: 13, color: '#374151', flex: 1 }}>
                                                                            <Text style={{ fontWeight: '600', color: '#6B7280' }}>Note: </Text>
                                                                            {transaction.note}
                                                                        </Text>
                                                                    </View>
                                                                ) : null}


                                                            </View>
                                                        );
                                                    })}

                                                    {/* Pagination Card */}
                                                    {totalItems > 0 && (
                                                        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, marginHorizontal: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, borderWidth: 1, borderColor: '#F3F4F6' }}>
                                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                                                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                                                                    Showing {startIdx + 1} to {endIdx} of <Text style={{ fontWeight: '700' }}>{totalItems} transactions</Text>
                                                                </Text>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, position: 'relative', zIndex: 10 }}>
                                                                    <Text style={{ fontSize: 12, color: '#6B7280' }}>Show:</Text>
                                                                    <TouchableOpacity
                                                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, gap: 4 }}
                                                                        onPress={() => setShowPerPageDropdown(!showPerPageDropdown)}
                                                                    >
                                                                        <Text style={{ fontSize: 12, color: '#111827', fontWeight: '500' }}>{perPage}</Text>
                                                                        <Ionicons name={showPerPageDropdown ? 'chevron-up' : 'chevron-down'} size={14} color="#6B7280" />
                                                                    </TouchableOpacity>
                                                                    {showPerPageDropdown && (
                                                                        <View style={{ position: 'absolute', bottom: '100%', right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginBottom: 4, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, minWidth: 60, zIndex: 100 }}>
                                                                            {[5, 10, 25, 50].map(val => (
                                                                                <TouchableOpacity
                                                                                    key={val}
                                                                                    style={[{ paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }, perPage === val && { backgroundColor: '#EFF6FF' }]}
                                                                                    onPress={() => { setPerPage(val); setCurrentPage(1); setShowPerPageDropdown(false); }}
                                                                                >
                                                                                    <Text style={[{ fontSize: 13, color: '#374151' }, perPage === val && { color: '#2563EB', fontWeight: '600' }]}>{val}</Text>
                                                                                </TouchableOpacity>
                                                                            ))}
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            </View>
                                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <TouchableOpacity
                                                                    style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 4 }, currentPage <= 1 && { opacity: 0.5 }]}
                                                                    onPress={() => { if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                                                                    disabled={currentPage <= 1}
                                                                >
                                                                    <Ionicons name="chevron-back" size={14} color={currentPage <= 1 ? '#D1D5DB' : '#374151'} />
                                                                    <Text style={[{ fontSize: 13, color: '#374151', fontWeight: '500' }, currentPage <= 1 && { color: '#D1D5DB' }]}>Previous</Text>
                                                                </TouchableOpacity>
                                                                <View style={{ alignItems: 'center' }}>
                                                                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Page</Text>
                                                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{currentPage} of {totalPages}</Text>
                                                                </View>
                                                                <TouchableOpacity
                                                                    style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 4 }, currentPage >= totalPages && { opacity: 0.5 }]}
                                                                    onPress={() => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                                                                    disabled={currentPage >= totalPages}
                                                                >
                                                                    <Text style={[{ fontSize: 13, color: '#374151', fontWeight: '500' }, currentPage >= totalPages && { color: '#D1D5DB' }]}>Next</Text>
                                                                    <Ionicons name="chevron-forward" size={14} color={currentPage >= totalPages ? '#D1D5DB' : '#374151'} />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    )}
                                                </>
                                            );
                                        })()
                                    )}
                                </View>
                            </>
                        )}

                    </ScrollView>
                </View>

                {/* Toast Notification - Global */}
                {renderToast()}

                {/* Bottom Navigation */}
                <ShopBottomNav activeTab="customers" />



                {/* Add Transaction Modal */}
                <AddTransactionModal
                    visible={showAddTransactionModal}
                    onClose={() => setShowAddTransactionModal(false)}
                    shopId={shopId}
                    onSuccess={handleTransactionSuccess}
                />

                {/* Payment Request Modal */}
                <PaymentRequestModal
                    visible={showPaymentRequestModal}
                    onClose={() => setShowPaymentRequestModal(false)}
                    customer={customer}
                    transactions={transactions}
                    showToast={showToast}
                    renderToast={renderToast}
                />
                {/* DateTime Pickers */}
                {showFromDatePicker && (
                    <DateTimePicker
                        value={dateFrom || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                            setShowFromDatePicker(false);
                            if (event.type === 'set' && selectedDate) {
                                setDateFrom(selectedDate);
                            } else if (event.type === 'dismissed') {
                                setDateFrom(null);
                            }
                        }}
                        positiveButton={{ label: 'Set', textColor: '#2563EB' }}
                        negativeButton={{ label: 'Clear', textColor: '#EF4444' }}
                    />
                )}
                {showToDatePicker && (
                    <DateTimePicker
                        value={dateTo || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                            setShowToDatePicker(false);
                            if (event.type === 'set' && selectedDate) {
                                setDateTo(selectedDate);
                            } else if (event.type === 'dismissed') {
                                setDateTo(null);
                            }
                        }}
                        positiveButton={{ label: 'Set', textColor: '#2563EB' }}
                        negativeButton={{ label: 'Clear', textColor: '#EF4444' }}
                    />
                )}
                {/* Add Transaction Modal */}
                <AddTransactionModal
                    visible={showAddTransactionModal}
                    onClose={() => setShowAddTransactionModal(false)}
                    shopId={shopId}
                    onSuccess={handleTransactionSuccess}
                    preselectedCustomer={customer}
                />
            </View>
        </SafeAreaView>
    );
};

const PaymentRequestModal = ({ visible, onClose, customer, transactions, showToast, renderToast }) => {
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
            const response = await customerAPI.getCustomerNotifications(customer.shop_id, customer.id);
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
            template = `ShopMunim: Dear ${customerName}, your payment is ${delay}. Balance: ₹${customerBalance}. (Auto-reminder: ${freq})`;
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

    // Helper functions for formatting
    const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

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
        return formatShortDate(dateString);
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
                                                <Text style={modalStyles.cardLabel}>Customer Name</Text>
                                                <Text style={modalStyles.cardValue}>{customer.name}</Text>
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={modalStyles.cardLabel}>Phone Number</Text>
                                                <Text style={modalStyles.cardValue}>{customer.phone}</Text>
                                            </View>
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <View style={{ flex: 1, marginRight: 10 }}>
                                                <Text style={modalStyles.cardLabel}>Outstanding Amount</Text>
                                                <Text style={[modalStyles.cardValue, { color: '#EF4444' }]}>
                                                    {(customer.balance || 0) < 0 ? '-' : ''}₹{Math.abs(customer.balance || 0).toFixed(2)}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={modalStyles.cardLabel}>Last Transaction</Text>
                                                <Text style={[modalStyles.cardValue, { fontWeight: '500', color: '#6B7280' }]}>
                                                    {sortedTransactions.length > 0 ? timeAgo(sortedTransactions[0].date) : 'No transactions'}
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

                                            {/* Status Box - Only show for Payment Due Reminder */}
                                            {requestType === 'Payment Due Reminder' && (
                                                customer?.balance < 0 ? (
                                                    <View style={[modalStyles.paymentStatusBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                                                        <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
                                                        <Text style={[modalStyles.paymentStatusText, { color: '#DC2626' }]}>
                                                            Payment Pending of {formatCurrency(Math.abs(customer?.balance || 0))}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <View style={[modalStyles.paymentStatusBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                                                        <Ionicons name="checkmark-circle-outline" size={20} color="#059669" />
                                                        <Text style={[modalStyles.paymentStatusText, { color: '#059669' }]}>
                                                            No pending dues - All payments up to date!
                                                        </Text>
                                                    </View>
                                                )
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
                                                                if (false) {
                                                                    // Log to backend first
                                                                    try {
                                                                        await customerAPI.notifyPayment(customer.shop_id, customer.id, {
                                                                            title: 'Phone Call',
                                                                            body: 'Contacted via phone call',
                                                                            method: 'Phone Call'
                                                                        });
                                                                    } catch (e) {
                                                                        console.log('Error logging Phone Call to backend:', e);
                                                                    }
                                                                    Linking.openURL(url);
                                                                    onClose();
                                                                } else {
                                                                    showToast('Phone calls are not available on this device');
                                                                }
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
                                                                const template = `Dear ${name},\n\nYou have a pending payment of ₹${amount} at our shop.\n\nPlease make the payment at your earliest convenience. You can pay via UPI or visit our shop.\n\nThank you!\n- Shop Owner`;
                                                                setReminderMessage(template);
                                                            } else if (requestType === 'Advance Payment Request') {
                                                                const amount = advanceAmount || '0.00';
                                                                const reason = (advanceReason && advanceReason.trim()) ? advanceReason : 'your order';
                                                                const template = `Dear ${name},\n\nThis is a request for an advance payment of ₹${amount} for ${reason}.\n\nPlease complete the payment to proceed with your request.\n\nThank you!\n- Shop Owner`;
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
                                                <View style={{ marginTop: 4, height: 1, backgroundColor: '#E5E7EB' }} />
                                                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Characters: {reminderMessage.length}/500</Text>
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
                                                            if (event.type === 'set' && selectedDate) {
                                                                setScheduleDate(selectedDate);
                                                            } else if (event.type === 'dismissed') {
                                                                setScheduleDate(null);
                                                            }
                                                        }}
                                                        positiveButton={{ label: 'Set', textColor: '#2563EB' }}
                                                        negativeButton={{ label: 'Clear', textColor: '#EF4444' }}
                                                    />
                                                )}

                                                {showScheduleTimePicker && (
                                                    <DateTimePicker
                                                        value={scheduleTime || new Date()}
                                                        mode="time"
                                                        display="default"
                                                        onChange={(event, selectedTime) => {
                                                            setShowScheduleTimePicker(false);
                                                            if (event.type === 'set' && selectedTime) {
                                                                setScheduleTime(selectedTime);
                                                            } else if (event.type === 'dismissed') {
                                                                setScheduleTime(null);
                                                            }
                                                        }}
                                                        positiveButton={{ label: 'Set', textColor: '#2563EB' }}
                                                        negativeButton={{ label: 'Clear', textColor: '#EF4444' }}
                                                    />
                                                )}
                                            </View>

                                            {/* Send Button */}
                                            <TouchableOpacity
                                                disabled={isSending}
                                                onPress={async () => {
                                                    if (sendVia === 'Push Notification') {
                                                        if (!reminderMessage.trim()) {
                                                            showToast('Please enter a message to send');
                                                            return;
                                                        }
                                                        setIsSending(true);
                                                        try {
                                                            let scheduledAt = null;
                                                            if (scheduleDate && scheduleTime) {
                                                                const sDate = new Date(scheduleDate);
                                                                const sTime = new Date(scheduleTime);
                                                                sDate.setHours(sTime.getHours());
                                                                sDate.setMinutes(sTime.getMinutes());
                                                                scheduledAt = sDate.toISOString();
                                                            }

                                                            const payload = {
                                                                title: requestType,
                                                                body: reminderMessage,
                                                                data: { customerId: customer.id },
                                                                method: sendVia,
                                                                scheduled_at: scheduledAt
                                                            };
                                                            await customerAPI.notifyPayment(customer.shop_id, customer.id, payload);
                                                            showToast(scheduledAt ? 'Reminder scheduled successfully!' : 'Payment reminder sent successfully!');
                                                            onClose();
                                                        } catch (error) {
                                                            const errorMsg = error.response?.data?.detail || 'Failed to process request';
                                                            showToast(errorMsg);
                                                        } finally {
                                                            setIsSending(false);
                                                        }
                                                    } else if (sendVia === 'SMS Message') {
                                                        if (!reminderMessage.trim()) {
                                                            showToast('Please enter a message to send');
                                                            return;
                                                        }
                                                        showToast('Opening SMS app...');
                                                        const url = Platform.OS === 'ios'
                                                            ? `sms:${customer.phone}&body=${encodeURIComponent(reminderMessage)}`
                                                            : `sms:${customer.phone}?body=${encodeURIComponent(reminderMessage)}`;

                                                        // Log to backend
                                                        try {
                                                            await customerAPI.notifyPayment(customer.shop_id, customer.id, {
                                                                title: requestType,
                                                                body: reminderMessage,
                                                                method: 'SMS Message'
                                                            });
                                                        } catch (e) {
                                                            showToast('Failed to log SMS to backend', e);
                                                        }

                                                        Linking.canOpenURL(url).then(supported => {
                                                            if (!supported) {
                                                                showToast('SMS is not available on this device');
                                                            } else {
                                                                return Linking.openURL(url);
                                                            }
                                                        }).catch(() => showToast('Could not open SMS app'));
                                                        onClose();
                                                    } else if (sendVia === 'WhatsApp') {
                                                        if (!reminderMessage.trim()) {
                                                            showToast('Please enter a message to send');
                                                            return;
                                                        }
                                                        showToast('Opening WhatsApp...');
                                                        let phoneString = customer.phone.replace(/[^0-9]/g, '');
                                                        if (phoneString.length === 10) {
                                                            phoneString = '91' + phoneString; // Assume India (+91) if 10 digits
                                                        }
                                                        const url = `whatsapp://send?phone=${phoneString}&text=${encodeURIComponent(reminderMessage)}`;

                                                        // Log to backend
                                                        try {
                                                            await customerAPI.notifyPayment(customer.shop_id, customer.id, {
                                                                title: requestType,
                                                                body: reminderMessage,
                                                                method: 'WhatsApp'
                                                            });
                                                        } catch (e) {
                                                            showToast('Failed to log WhatsApp to backend', e);
                                                        }

                                                        Linking.openURL(url).catch(() => {
                                                            // Fallback to web universal link
                                                            Linking.openURL(`https://wa.me/${phoneString}?text=${encodeURIComponent(reminderMessage)}`).catch(() => {
                                                                showToast('Make sure WhatsApp is installed');
                                                            });
                                                        });
                                                        onClose();
                                                    } else if (sendVia === 'Phone Call') {
                                                        showToast('Opening Phone app...');
                                                        const url = `tel:${customer.phone}`;
                                                        Linking.canOpenURL(url).then(supported => {
                                                            if (!supported) {
                                                                showToast('Phone calls are not available on this device');
                                                            } else {
                                                                return Linking.openURL(url);
                                                            }
                                                        }).catch(() => showToast('Could not open Phone app'));
                                                        onClose();
                                                    } else {
                                                        showToast(`${sendVia} is not yet implemented fully.`);
                                                    }
                                                }}
                                            >
                                                <LinearGradient
                                                    colors={isSending ? ['#9CA3AF', '#6B7280'] : ['#F97316', '#EF4444']}
                                                    style={modalStyles.paymentSendBtn}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                >
                                                    {isSending ? (
                                                        <ActivityIndicator color="#fff" size="small" />
                                                    ) : (
                                                        <>
                                                            <Text style={modalStyles.paymentSendBtnText}>Send Reminder</Text>
                                                            <Ionicons name="paper-plane-outline" size={20} color="#fff" />
                                                        </>
                                                    )}
                                                </LinearGradient>
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
                                                        await customerAPI.update(customer.shop_id, customer.id, updateData);
                                                        showToast('Auto reminder settings saved successfully!');

                                                        // We should ideally trigger a refresh of the customer data in the parent component
                                                        // but since onClose is called, the user will see the toast and close the modal.
                                                        onClose();
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
                                                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{item.title}</Text>
                                                                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                                            </View>
                                                            <Text style={{ fontSize: 12, color: '#6B7280' }} numberOfLines={1}>{item.message}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                                <Text style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>{item.method}</Text>
                                                                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB', marginHorizontal: 6 }} />
                                                                <Text style={{ fontSize: 10, color: item.status === 'sent' ? '#059669' : '#EF4444', fontWeight: '600' }}>{item.status}</Text>
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
                    </ScrollView >
                </View >
                {renderToast()}
            </KeyboardAvoidingView >
        </Modal >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    // Header styles - Same as Dashboard
    header: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logo: {
        fontSize: 20,
        fontWeight: '700',
        color: '#3B82F6',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    roleSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    roleSelectorText: {
        fontSize: 13,
        color: '#374151',
        fontWeight: '500',
    },
    headerLogout: {
        fontSize: 13,
        color: '#EF4444',
        fontWeight: '500',
    },
    headerBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    welcomeText: {
        fontSize: 14,
        color: '#6B7280',
    },
    userName: {
        fontWeight: '600',
        color: '#111827',
    },
    phoneContainer: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    phoneText: {
        fontSize: 12,
        color: '#374151',
    },
    content: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
        flexGrow: 1,
        paddingHorizontal: 16,
        paddingBottom: 120,
    },

    // Page content styles
    backRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 12,
    },
    backButton: {
        padding: 4,
        marginRight: 12,
    },
    pageTitle: {},
    pageTitleText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    pageSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#6B7280',
    },
    customerCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    customerLeft: {
        flex: 1,
    },
    customerBalanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    customerName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    customerPhone: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    customerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    balanceAmount: {
        fontSize: 20,
        fontWeight: '700',
    },
    balanceBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
    },
    balanceBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    addTransactionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 10,
        marginBottom: 10,
    },
    addTransactionText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
        marginLeft: 8,
    },
    sendUpiBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    sendUpiBtnText: {
        color: '#374151',
        fontWeight: '500',
        fontSize: 14,
        marginLeft: 6,
    },
    paymentRequestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 10,
        marginBottom: 20,
    },
    paymentRequestText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
        marginLeft: 8,
    },
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginLeft: 6,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statBox: {
        width: '48%',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
        textAlign: 'center',
    },
    statSubValue: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    netBalanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
    },
    netBalanceLabel: {
        fontSize: 13,
        color: '#374151',
        fontWeight: '500',
    },
    netBalanceRight: {
        alignItems: 'flex-end',
    },
    netBalanceValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    netBalanceStatus: {
        fontSize: 11,
        fontWeight: '500',
    },
    filterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    filterTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    exportButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    pdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 6,
        backgroundColor: '#FEF2F2',
    },
    pdfBtnText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#EF4444',
        marginLeft: 4,
    },
    excelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#86EFAC',
        borderRadius: 6,
        backgroundColor: '#F0FDF4',
    },
    excelBtnText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#10B981',
        marginLeft: 4,
    },
    dateFiltersRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    dateFilterItem: {
        flex: 1,
    },
    filterLabel: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
        marginBottom: 4,
    },
    dateInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    dateInput: {
        flex: 1,
        fontSize: 13,
        color: '#111827',
    },
    typeFilterContainer: {
        marginTop: 4,
    },
    typeDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    typeDropdownText: {
        fontSize: 13,
        color: '#111827',
    },
    historySection: {
        marginBottom: 16,
    },
    historyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    historyCount: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 12,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 12,
    },
    transactionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    txHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    txBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
    },
    txBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    txAmountSection: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontSize: 18,
        fontWeight: '700',
    },
    txAmountLabel: {
        fontSize: 11,
        color: '#6B7280',
    },
    txDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    txDate: {
        fontSize: 12,
        color: '#6B7280',
        marginLeft: 4,
    },
    txNoteBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        padding: 8,
        borderRadius: 6,
        marginTop: 10,
    },
    txNoteText: {
        fontSize: 12,
        color: '#047857',
    },
    itemsSection: {
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    itemsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E40AF',
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 6,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    itemInfo: {},
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    itemPrice: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
    },
    itemQtySection: {
        alignItems: 'flex-end',
    },
    itemQty: {
        fontSize: 11,
        color: '#374151',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    itemSubtotal: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2563EB',
        marginTop: 4,
    },
    itemsTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#BFDBFE',
    },
    itemsTotalLabel: {
        fontSize: 12,
        color: '#1E40AF',
        fontWeight: '500',
    },
    itemsTotalValue: {
        fontSize: 13,
        color: '#2563EB',
        fontWeight: '700',
    },
    // Filter & Export styles
    customerDetailDropdownOptions: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        marginTop: 4,
        zIndex: 100,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    customerDetailDropdownOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    customerDetailDropdownOptionActive: {
        backgroundColor: '#F9FAFB',
    },
    customerDetailDropdownOptionText: {
        fontSize: 13,
        color: '#374151',
    },
    customerDetailDropdownOptionTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },

    // Toast notification styles
    toastContainer: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        zIndex: 9999,
        alignItems: 'center',
    },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 12,
        gap: 10,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    toastIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
    },
    toastText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
    },
});



// Payment Request Modal Styles
const modalStyles = StyleSheet.create({
    paymentModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    paymentModalContent: {
        backgroundColor: '#F3F4F6',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '90%',
        width: '100%',
    },
    paymentModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    paymentModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 8,
    },
    paymentCustomerCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    avatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    cardValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    paymentModalTabs: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 4,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    paymentModalTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
    },
    paymentModalTabActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    paymentModalTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginLeft: 8,
    },
    paymentModalTabTextActive: {
        color: '#111827',
    },
    paymentMainCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 60,
    },
    paymentTabContent: {
        padding: 16,
    },
    paymentModalSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    paymentModalLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6,
    },
    paymentModalDropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
    },
    paymentModalDropdownOptions: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        marginTop: 4,
        zIndex: 1000,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    paymentModalDropdownOption: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    paymentStatusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#D1FAE5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    paymentStatusText: {
        fontSize: 13,
        color: '#047857',
        fontWeight: '600',
        marginLeft: 8,
        flex: 1,
    },
    paymentTemplateBtn: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    paymentMessageInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        backgroundColor: '#fff',
        height: 180,
    },
    paymentSendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 10,
        marginTop: 8,
    },
    paymentSendBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    paymentTab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 6,
    },
    paymentTabActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    paymentTabText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    paymentTabTextActive: {
        color: '#111827',
        fontWeight: '600',
    },
    paymentModalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    paymentChannelRow: {
        flexDirection: 'row',
        gap: 12,
    },
    paymentChannelBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        gap: 6,
    },
    paymentChannelBtnActive: {
        borderColor: '#2563EB',
        backgroundColor: '#EFF6FF',
    },
    paymentChannelText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    paymentChannelTextActive: {
        color: '#2563EB',
    },
    paymentIncludeRow: {
        flexDirection: 'row',
        gap: 16,
    },
    paymentIncludeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterActive: {
        borderColor: '#2563EB',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#2563EB',
    },
    paymentIncludeText: {
        fontSize: 14,
        color: '#374151',
    },
    paymentMessageInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        backgroundColor: '#F9FAFB',
        height: 80,
    },
    paymentSendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 8,
        gap: 8,
        marginTop: 8,
        marginBottom: 40,
    },
    paymentSendBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    paymentModalSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    paymentModalSection: {
        // Any specific style for section if needed
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

    // Pagination styles (matched with customer side)
    paginationCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, marginHorizontal: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, borderWidth: 1, borderColor: '#F3F4F6' },
    paginationTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    paginationInfo: { fontSize: 12, color: '#6B7280' },
    paginationShowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, position: 'relative', zIndex: 10 },
    paginationShowLabel: { fontSize: 12, color: '#6B7280' },
    perPageDropdown: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
    perPageDropdownText: { fontSize: 13, color: '#111827', fontWeight: '500' },
    perPageDropdownOptions: { position: 'absolute', bottom: '100%', right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginBottom: 4, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, minWidth: 60, zIndex: 100 },
    perPageOption: { paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    perPageOptionActive: { backgroundColor: '#EFF6FF' },
    perPageOptionText: { fontSize: 13, color: '#374151' },
    perPageOptionTextActive: { color: '#2563EB', fontWeight: '600' },
    paginationBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paginationBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
    paginationBtnDisabled: { opacity: 0.5 },
    paginationBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    paginationBtnTextDisabled: { color: '#D1D5DB' },
    paginationCenter: { alignItems: 'center' },
    paginationPageLabel: { fontSize: 11, color: '#9CA3AF' },
    paginationPageNum: { fontSize: 14, fontWeight: '600', color: '#111827' },
});

export default CustomerDetailScreen;

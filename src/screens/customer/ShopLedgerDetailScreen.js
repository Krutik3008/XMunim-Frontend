import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    Modal,
    BackHandler,
    TouchableWithoutFeedback,
    Keyboard,
    Dimensions,
    Platform,
    RefreshControl,
    Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { customerAPI, shopAPI } from '../../api';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import CustomerHeader from '../../components/customer/CustomerHeader';
import CustomerBottomNav from '../../components/customer/CustomerBottomNav';
import { saveFileToDevice } from '../../utils/downloadHelper';

// Shared saveFileToDevice removed - now using utils/downloadHelper.js

const ShopLedgerDetailScreen = ({
    route,
    customer: propCustomer,
    shopId: propShopId,
    onBack,
    initialTransactions,
    initialShopDetails,
    activeTab: propActiveTab,
    onTabChange
}) => {

    const navigation = useNavigation();
    const { user, logout, switchRole } = useAuth();
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [localActiveTab, setLocalActiveTab] = useState('ledger');

    const activeTab = propActiveTab || localActiveTab;
    const setActiveTab = onTabChange || setLocalActiveTab;

    // Determine source of data (props or route)
    const customer = propCustomer || route?.params?.customer;
    const shopId = propShopId || route?.params?.shopId;

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigation.goBack();
        }
    };

    const handleRoleSwitch = async (role) => {
        setShowRoleDropdown(false);
        if (role !== user?.active_role) {
            const success = await switchRole(role);
            if (success) {
                const message = `Role switched to ${role === 'shop_owner' ? 'Shop Owner' : 'Admin'}`;
                if (role === 'shop_owner') {
                    navigation.reset({ index: 0, routes: [{ name: 'ShopOwnerDashboard', params: { successMessage: message } }] });
                } else if (role === 'admin') {
                    navigation.reset({ index: 0, routes: [{ name: 'AdminPanel', params: { successMessage: message } }] });
                }
            }
        }
    };

    const handleTabChange = (tab) => {
        if (onTabChange) {
            onTabChange(tab);
        } else {
            setLocalActiveTab(tab);
            navigation.navigate('CustomerDashboard', { initialTab: tab });
        }
    };

    // Android hardware back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBack();
            return true;
        });
        return () => backHandler.remove();
    }, [onBack]);

    // Safety check for customer
    if (!customer) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#1e40af" />
                <Text style={{ color: '#111827', marginTop: 10 }}>Loading details...</Text>
            </View>
        );
    }

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [shopDetails, setShopDetails] = useState(null);
    const [stats, setStats] = useState({
        totalTransactions: 0,
        totalCredit: 0,
        totalPayments: 0,
        itemsPurchased: 0,
        netBalance: 0,
        totalCredits: 0,
        totalCreditsAmount: 0,
        totalPaymentsAmount: 0,
        totalItems: 0
    });

    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const [transactionType, setTransactionType] = useState('all');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef(null);

    const showToast = (message) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToastMessage(message);
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

    useEffect(() => {
        loadData();
    }, [customer?.id, shopId]);

    useEffect(() => {
        applyFilters();
    }, [transactions, fromDate, toDate, transactionType]);

    const loadData = async () => {
        // Only show full loading if not refreshing
        if (!refreshing) setLoading(true);
        try {
            if (initialTransactions && !refreshing) {
                const sortedTx = [...initialTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
                setTransactions(sortedTx);
            } else {
                const txRes = await customerAPI.getTransactions(shopId, customer.id);
                const sortedTx = (txRes.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
                setTransactions(sortedTx);
            }

            if (initialShopDetails && !refreshing) {
                setShopDetails(initialShopDetails);
            } else {
                const shopRes = await shopAPI.getDashboard(shopId);
                setShopDetails(shopRes.data?.shop);
            }
        } catch (error) {
            console.error("Error loading details:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const applyFilters = () => {
        let filtered = [...transactions];

        if (fromDate) {
            const startDate = new Date(fromDate);
            startDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(t => new Date(t.date) >= startDate);
        }

        if (toDate) {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => new Date(t.date) <= endDate);
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

    const calculateStats = (txs) => {
        const credits = txs.filter(t => t.type === 'credit' || t.type === 'DEBIT');
        const payments = txs.filter(t => t.type === 'payment' || t.type === 'CREDIT' || t.type === 'debit');

        const totalCreditsAmount = credits.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalPaymentsAmount = payments.reduce((sum, t) => sum + (t.amount || 0), 0);

        const totalItems = txs.reduce((sum, t) => {
            const items = t.products || t.items || [];
            return sum + items.reduce((itemSum, p) => itemSum + (p.quantity || 0), 0);
        }, 0);

        setStats({
            totalTransactions: txs.length,
            totalCredits: credits.length,
            totalPayments: payments.length,
            totalCreditsAmount,
            totalPaymentsAmount,
            totalItems,
            totalCredit: totalCreditsAmount,
            itemsPurchased: totalItems,
            netBalance: totalPaymentsAmount - totalCreditsAmount
        });
    };

    const formatCurrency = (amount) => {
        return `₹${parseFloat(amount || 0).toFixed(2)}`;
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

    const onFromDateChange = (event, selectedDate) => {
        setShowFromPicker(false);
        if (event.type === 'set' && selectedDate) {
            setFromDate(selectedDate);
        } else if (event.type === 'dismissed') {
            setFromDate(null);
        }
    };

    const onToDateChange = (event, selectedDate) => {
        setShowToPicker(false);
        if (event.type === 'set' && selectedDate) {
            setToDate(selectedDate);
        } else if (event.type === 'dismissed') {
            setToDate(null);
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

            const balanceStatus = stats.netBalance > 0 ? 'Credit' : (stats.netBalance < 0 ? 'Dues' : 'Clear');

            const txRows = filteredTransactions.map(t => {
                const isPay = t.type === 'debit' || t.type === 'payment' || t.type === 'CREDIT';
                const items = t.products || t.items || [];
                const itemNames = items.map(i => i.name || 'Item').join(', ') || '-';
                const totalQty = items.reduce((s, i) => s + (i.quantity || 1), 0);
                const typeColor = isPay ? '#10B981' : '#DC2626';
                const typeLabel = isPay ? 'Payment Made' : 'Credit Taken';
                const amountColor = isPay ? '#10B981' : '#DC2626';
                return `<tr>
                    <td>${formatShortDate(t.date)}<br/><span style="font-size:9px;color:#6B7280">${formatTime(t.date)}</span></td>
                    <td style="color:${typeColor};font-weight:600">${typeLabel}</td>
                    <td>${itemNames}</td>
                    <td>${items.length > 0 ? totalQty : '-'}</td>
                    <td style="color:${amountColor};font-weight:600">\u20b9${parseFloat(t.amount || 0).toFixed(2)}</td>
                    <td>${t.note || t.notes || '-'}</td>
                </tr>`;
            }).join('');

            const html = `
            <html><head><style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111827; font-size: 12px; }
                .header { text-align: center; margin-bottom: 24px; }
                .header h1 { font-size: 20px; color: #111827; margin-bottom: 6px; }
                .header h1 span { color: #2563EB; margin-right: 6px; }
                .generated { color: #6B7280; font-size: 11px; margin-top: 4px; }
                .section { background: #F9FAFB; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
                .section-title { font-size: 14px; font-weight: bold; color: #111827; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
                .section-title span { color: #2563EB; }
                .info-row { margin-bottom: 4px; font-size: 12px; color: #374151; }
                .info-row b { color: #111827; min-width: 110px; display: inline-block; }
                .analytics { display: flex; gap: 12px; margin-bottom: 20px; }
                .analytics-box { flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; text-align: center; background: #fff; }
                .analytics-box .label { font-size: 11px; color: #374151; font-weight: 600; margin-bottom: 8px; }
                .analytics-box .value { font-size: 18px; font-weight: bold; }
                .analytics-box .sub { font-size: 12px; color: #374151; margin-top: 2px; }
                .green { color: #10B981; }
                .red { color: #DC2626; }
                .blue { color: #2563EB; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #F9FAFB; color: #6B7280; padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; border-bottom: 2px solid #E5E7EB; }
                td { padding: 10px 8px; border-bottom: 1px solid #F3F4F6; font-size: 11px; }
                tr:hover { background: #FAFAFA; }
                .footer { text-align: center; color: #9CA3AF; font-size: 10px; margin-top: 20px; padding-top: 12px; border-top: 1px solid #E5E7EB; }
            </style></head><body>

                <div class="header">
                    <h1><span>📋</span> Transaction Report</h1>
                    <div class="generated">${fromDate || toDate ? `Period: ${fromDate ? formatDateDisplay(fromDate) : 'Beginning'} to ${toDate ? formatDateDisplay(toDate) : 'Today'}` : 'Period: Full History'}</div>
                    <div class="generated">Generated on: ${generatedDate}</div>
                </div>

                <div class="section">
                    <div class="section-title"><span>🏪</span> Shop Information</div>
                    <div class="info-row"><b>Shop Name:</b> ${shopDetails?.name || 'N/A'}</div>
                    <div class="info-row"><b>Category:</b> ${shopDetails?.category || 'N/A'}</div>
                    <div class="info-row"><b>Location:</b> ${shopDetails?.location || 'N/A'}</div>
                    <div class="info-row"><b>Shop Code:</b> ${shopDetails?.shop_code || 'N/A'}</div>
                </div>

                <div class="section">
                    <div class="section-title"><span>👤</span> Personal Information</div>
                    <div class="info-row"><b>Name:</b> ${customer.name}</div>
                    <div class="info-row"><b>Phone:</b> +91 ${customer.phone}</div>
                    <div class="info-row"><b>Current Balance:</b> ${stats.netBalance !== 0 ? (stats.netBalance > 0 ? '+' : '-') : ''}₹${Math.abs(stats.netBalance).toFixed(2)}</div>
                    <div class="info-row"><b>Status:</b> ${balanceStatus}</div>
                </div>

                <div class="analytics">
                    <div class="analytics-box">
                        <div class="label">Total Transactions</div>
                        <div class="value blue">${stats.totalTransactions}</div>
                    </div>
                    <div class="analytics-box">
                        <div class="label">Credit Taken</div>
                        <div class="value red">${stats.totalCredits}</div>
                        <div class="sub">\u20b9${stats.totalCreditsAmount.toFixed(2)}</div>
                    </div>
                    <div class="analytics-box">
                        <div class="label">Payments Made</div>
                        <div class="value green">${stats.totalPayments}</div>
                        <div class="sub">\u20b9${stats.totalPaymentsAmount.toFixed(2)}</div>
                    </div>
                    <div class="analytics-box">
                        <div class="label">Items Purchased</div>
                        <div class="value blue">${stats.itemsPurchased || 0}</div>
                    </div>
                </div>

                <table>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Items</th>
                        <th>Quantity</th>
                        <th>Amount</th>
                        <th>Note</th>
                    </tr>
                    ${txRows}
                </table>

                <div class="footer">Report generated via ShopMunim App</div>
            </body></html>`;

            const { uri } = await Print.printToFileAsync({ html });
            const pdfName = `${customer.name}_Report.pdf`;
            const tempUri = FileSystem.cacheDirectory + pdfName;
            await FileSystem.moveAsync({ from: uri, to: tempUri });

            if (Platform.OS === 'android') {
                const base64Content = await FileSystem.readAsStringAsync(tempUri, { encoding: 'base64' });
                const result = await saveFileToDevice(pdfName, base64Content, 'application/pdf');
                if (result.success) {
                    showToast('Download Successful');
                }
            } else {
                // iOS: save via helper
                const base64Content = await FileSystem.readAsStringAsync(tempUri, { encoding: 'base64' });
                const result = await saveFileToDevice(pdfName, base64Content, 'application/pdf');
                if (result.success) {
                    showToast('Download Successful');
                }
            }
        } catch (error) {
            console.log('PDF export error:', error);
            showToast('Failed to generate PDF');
        }
    };

    const exportToExcel = async () => {
        try {
            const now = new Date();
            const reportDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

            const rows = [];
            rows.push([`Shop: ${shopDetails?.name || 'N/A'}`]);
            rows.push([`Category: ${shopDetails?.category || 'N/A'}`]);
            rows.push([`Location: ${shopDetails?.location || 'N/A'}`]);
            rows.push([`Shop Code: ${shopDetails?.shop_code || 'N/A'}`]);
            rows.push([]);
            rows.push([`Customer: ${customer.name} (${customer.phone})`]);
            rows.push([`Report Generated: ${reportDate}`]);
            rows.push([`Period: ${fromDate || toDate ? `${fromDate ? formatDateDisplay(fromDate) : 'Beginning'} to ${toDate ? formatDateDisplay(toDate) : 'Today'}` : 'Full History'}`]);
            rows.push([]);
            rows.push(['Date', 'Type', 'Items', 'Quantity', 'Amount', 'Note']);

            filteredTransactions.forEach(t => {
                const isPay = t.type === 'debit' || t.type === 'payment' || t.type === 'CREDIT';
                const items = t.products || t.items || [];
                const itemNames = items.map(i => i.name || 'Item').join(', ') || '';
                const totalQty = items.length > 0 ? items.reduce((s, i) => s + (i.quantity || 1), 0) : '';
                rows.push([
                    `${formatShortDate(t.date)} ${formatTime(t.date)}`,
                    isPay ? 'Payment Made' : 'Credit Taken',
                    itemNames,
                    totalQty,
                    parseFloat(t.amount || 0),
                    t.note || t.notes || ''
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(rows);

            ws['!cols'] = [
                { wch: 22 }, // Date
                { wch: 20 }, // Type
                { wch: 15 }, // Items
                { wch: 10 }, // Quantity
                { wch: 12 }, // Amount
                { wch: 15 }, // Note
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

            const fileName = `${customer.name}_Report.xlsx`;
            const fileUri = FileSystem.cacheDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: 'base64' });

            if (Platform.OS === 'android') {
                const result = await saveFileToDevice(fileName, wbout, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                if (result.success) {
                    showToast('Download Successful');
                }
            } else {
                // iOS: save via helper
                const result = await saveFileToDevice(fileName, wbout, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                if (result.success) {
                    showToast('Download Successful');
                }
            }
        } catch (error) {
            console.log('Excel export error:', error);
            showToast('Failed to generate Excel');
        }
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
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 }]}
                    keyboardShouldPersistTaps="handled"
                    onScrollBeginDrag={() => {
                        setShowTypeDropdown(false);
                        setShowPerPageDropdown(false);
                        Keyboard.dismiss();
                    }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#2563EB" />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.headerTitle}>Purchase History</Text>
                        </View>
                    </View>
                    {loading ? (
                        <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 40 }} />
                    ) : (
                        <>
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

                            {/* Customer Information Card */}
                            <View style={styles.card}>
                                <View style={styles.cardHeaderRow}>
                                    <Ionicons name="person-outline" size={20} color="#111827" />
                                    <Text style={styles.cardTitle}>Personal Information</Text>
                                </View>

                                <Text style={styles.customerNameMain}>{customer.name}</Text>
                                <Text style={styles.customerPhone}>+91 {customer.phone}</Text>

                                <View style={styles.balanceContainer}>
                                    <Text style={styles.balanceLabel}>Current Balance</Text>
                                    <View style={styles.balanceRight}>
                                        <Text style={[
                                            styles.balanceAmount,
                                            stats.netBalance > 0 ? styles.textGreen : (stats.netBalance < 0 ? styles.textRed : { color: '#374151' })
                                        ]}>
                                            {stats.netBalance !== 0 ? (stats.netBalance > 0 ? '+' : '-') : ''}₹{Math.abs(stats.netBalance).toFixed(2)}
                                        </Text>
                                        <View style={[
                                            styles.creditBadge,
                                            { backgroundColor: stats.netBalance > 0 ? '#10B981' : (stats.netBalance < 0 ? '#DC2626' : '#000000') }
                                        ]}>
                                            <Text style={[
                                                styles.creditText,
                                                stats.netBalance === 0 && { color: '#FFF' }
                                            ]}>
                                                {stats.netBalance > 0 ? 'Credit' : (stats.netBalance < 0 ? 'Dues' : 'Clear')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Analytics Card */}
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
                                        <Text style={styles.statLabel}>Credit Taken</Text>
                                        <Text style={[styles.statSubValue, { color: '#EF4444' }]}>{formatCurrency(stats.totalCreditsAmount)}</Text>
                                    </View>
                                    <View style={[styles.statBox, { backgroundColor: '#D1FAE5' }]}>
                                        <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.totalPayments}</Text>
                                        <Text style={styles.statLabel}>Payments Made</Text>
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
                                            onPress={() => setShowFromPicker(true)}
                                        >
                                            <Text style={[styles.dateInput, !fromDate && { color: '#9CA3AF' }]}>
                                                {fromDate ? formatDateDisplay(fromDate) : 'dd-mm-yyyy'}
                                            </Text>
                                            <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.dateFilterItem}>
                                        <Text style={styles.filterLabel}>To Date</Text>
                                        <TouchableOpacity
                                            style={styles.dateInputContainer}
                                            onPress={() => setShowToPicker(true)}
                                        >
                                            <Text style={[styles.dateInput, !toDate && { color: '#9CA3AF' }]}>
                                                {toDate ? formatDateDisplay(toDate) : 'dd-mm-yyyy'}
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
                                        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                                    </TouchableOpacity>
                                    {showTypeDropdown && (
                                        <View style={styles.dropdownOptions}>
                                            <TouchableOpacity
                                                style={[styles.dropdownOption, transactionType === 'all' && styles.dropdownOptionActive]}
                                                onPress={() => { setTransactionType('all'); setShowTypeDropdown(false); }}
                                            >
                                                <Text style={[styles.dropdownOptionText, transactionType === 'all' && styles.dropdownOptionTextActive]}>All Transactions</Text>
                                                {transactionType === 'all' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.dropdownOption, transactionType === 'credit' && styles.dropdownOptionActive]}
                                                onPress={() => { setTransactionType('credit'); setShowTypeDropdown(false); }}
                                            >
                                                <Text style={[styles.dropdownOptionText, transactionType === 'credit' && styles.dropdownOptionTextActive]}>Credits Only</Text>
                                                {transactionType === 'credit' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.dropdownOption, transactionType === 'payment' && styles.dropdownOptionActive]}
                                                onPress={() => { setTransactionType('payment'); setShowTypeDropdown(false); }}
                                            >
                                                <Text style={[styles.dropdownOptionText, transactionType === 'payment' && styles.dropdownOptionTextActive]}>Payments Only</Text>
                                                {transactionType === 'payment' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={styles.divider} />

                            {/* Detailed Transaction History */}
                            {(() => {
                                const totalItems = filteredTransactions.length;
                                const totalPages = Math.ceil(totalItems / perPage);
                                const startIdx = (currentPage - 1) * perPage;
                                const endIdx = Math.min(startIdx + perPage, totalItems);
                                const paginatedTx = filteredTransactions.slice(startIdx, endIdx);

                                return (
                                    <>
                                        <View style={styles.sectionCard}>
                                            <View style={styles.historyTextHeader}>
                                                <Text style={styles.historyTitle}>Detailed Transaction History</Text>
                                                <Text style={styles.historyCount}>Showing {filteredTransactions.length} transactions</Text>
                                            </View>

                                            {totalItems === 0 ? (
                                                <View style={styles.emptyState}>
                                                    <View style={styles.emptyStateBox}>
                                                        <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                                                        <Text style={styles.emptyText}>No transactions found</Text>
                                                    </View>
                                                </View>
                                            ) : (
                                                paginatedTx.map((transaction) => {
                                                    const isPaymentItem = transaction.type === 'debit' || transaction.type === 'payment' || transaction.type === 'CREDIT';
                                                    const items = transaction.products || transaction.items || [];
                                                    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
                                                    const subtotal = items.reduce((sum, item) => sum + (item.subtotal || (item.price || 0) * (item.quantity || 1)), 0);

                                                    return (
                                                        <View key={transaction.id} style={styles.flatTransactionRow}>
                                                            <View style={styles.txHeader}>
                                                                <View style={[styles.txBadge, { backgroundColor: isPaymentItem ? '#111827' : '#EF4444' }]}>
                                                                    <Text style={styles.txBadgeText}>{isPaymentItem ? 'Payment' : 'Purchase'}</Text>
                                                                </View>
                                                                <View style={styles.txAmountSection}>
                                                                    <Text style={[styles.txAmount, { color: isPaymentItem ? '#059669' : '#DC2626' }]}>
                                                                        {`${isPaymentItem ? '+' : '-'}₹${parseFloat(transaction.amount || 0).toFixed(2)}`}
                                                                    </Text>
                                                                    <Text style={styles.txAmountLabel}>Amount {isPaymentItem ? 'paid' : 'Dues'}</Text>
                                                                </View>
                                                            </View>

                                                            {isPaymentItem && (
                                                                <View style={styles.paymentStatusRow}>
                                                                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                                                                    <Text style={styles.paymentStatusText}>Payment received - Balance updated</Text>
                                                                </View>
                                                            )}

                                                            <View style={styles.txDateRow}>
                                                                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                                                                <Text style={styles.txDate}>{formatShortDate(transaction.date)}</Text>
                                                            </View>

                                                            {items.length > 0 && (
                                                                <View style={styles.itemsSection}>
                                                                    <View style={styles.itemsHeader}>
                                                                        <Ionicons name="cube-outline" size={14} color="#1E40AF" />
                                                                        <Text style={styles.itemsTitle}> Items Purchased:</Text>
                                                                    </View>
                                                                    {items.map((item, idx) => (
                                                                        <View key={idx} style={styles.itemRow}>
                                                                            <View style={styles.itemInfo}>
                                                                                <Text style={styles.itemName}>{item.name || 'Item'}</Text>
                                                                                <Text style={styles.itemPrice}>@ {formatCurrency(item.price || 0)} each</Text>
                                                                            </View>
                                                                            <View style={styles.itemQtySection}>
                                                                                <View style={styles.qtyBadge}>
                                                                                    <Text style={styles.qtyBadgeText}>Qty: {item.quantity || 1}</Text>
                                                                                </View>
                                                                                <Text style={styles.itemSubtotalValue}>{formatCurrency(item.subtotal || (item.price || 0) * (item.quantity || 1))}</Text>
                                                                            </View>
                                                                        </View>
                                                                    ))}
                                                                    <View style={styles.itemsSummary}>
                                                                        <Text style={styles.summaryText}>Total Items: {totalQuantity}</Text>
                                                                        <Text style={styles.summaryText}>Subtotal: {formatCurrency(subtotal)}</Text>
                                                                    </View>
                                                                </View>
                                                            )}

                                                            {(transaction.note || transaction.notes) ? (
                                                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF9E6', borderLeftWidth: 3, borderLeftColor: '#F59E0B', borderRadius: 8, padding: 10, marginTop: 8, gap: 6 }}>
                                                                    <Text style={{ fontSize: 13, color: '#374151', flex: 1 }}>
                                                                        <Text style={{ fontWeight: '600', color: '#6B7280' }}>Note: </Text>
                                                                        {transaction.note || transaction.notes}
                                                                    </Text>
                                                                </View>
                                                            ) : null}
                                                        </View>
                                                    );
                                                })
                                            )}
                                        </View>

                                        {/* Pagination Card */}
                                        {totalItems > 0 && (
                                            <View style={styles.paginationCard}>
                                                <View style={styles.paginationTopRow}>
                                                    <Text style={styles.paginationInfo}>
                                                        Showing {startIdx + 1} to {endIdx} of <Text style={{ fontWeight: '700' }}>{totalItems} transactions</Text>
                                                    </Text>
                                                    <View style={styles.paginationShowRow}>
                                                        <Text style={styles.paginationShowLabel}>Show:</Text>
                                                        <TouchableOpacity
                                                            style={styles.perPageDropdown}
                                                            onPress={() => setShowPerPageDropdown(!showPerPageDropdown)}
                                                        >
                                                            <Text style={styles.perPageDropdownText}>{perPage}</Text>
                                                            <Ionicons name={showPerPageDropdown ? 'chevron-up' : 'chevron-down'} size={14} color="#6B7280" />
                                                        </TouchableOpacity>
                                                        {showPerPageDropdown && (
                                                            <View style={styles.perPageDropdownOptions}>
                                                                {[5, 10, 25, 50].map(val => (
                                                                    <TouchableOpacity
                                                                        key={val}
                                                                        style={[styles.perPageOption, perPage === val && styles.perPageOptionActive]}
                                                                        onPress={() => { setPerPage(val); setCurrentPage(1); setShowPerPageDropdown(false); }}
                                                                    >
                                                                        <Text style={[styles.perPageOptionText, perPage === val && styles.perPageOptionTextActive]}>{val}</Text>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                                <View style={styles.paginationBottomRow}>
                                                    <TouchableOpacity
                                                        style={[styles.paginationBtn, currentPage <= 1 && styles.paginationBtnDisabled]}
                                                        onPress={() => { if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                                                        disabled={currentPage <= 1}
                                                    >
                                                        <Ionicons name="chevron-back" size={14} color={currentPage <= 1 ? '#D1D5DB' : '#374151'} />
                                                        <Text style={[styles.paginationBtnText, currentPage <= 1 && styles.paginationBtnTextDisabled]}>Previous</Text>
                                                    </TouchableOpacity>
                                                    <View style={styles.paginationCenter}>
                                                        <Text style={styles.paginationPageLabel}>Page</Text>
                                                        <Text style={styles.paginationPageNum}>{currentPage} of {totalPages}</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={[styles.paginationBtn, currentPage >= totalPages && styles.paginationBtnDisabled]}
                                                        onPress={() => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                                                        disabled={currentPage >= totalPages}
                                                    >
                                                        <Text style={[styles.paginationBtnText, currentPage >= totalPages && styles.paginationBtnTextDisabled]}>Next</Text>
                                                        <Ionicons name="chevron-forward" size={14} color={currentPage >= totalPages ? '#D1D5DB' : '#374151'} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </>
                                );
                            })()}

                            <View style={{ height: 70 }} />
                        </>
                    )}
                </ScrollView>

                {/* Toast Notification */}
                {toastVisible && (
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
                            <View style={styles.toastIcon}>
                                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                            </View>
                            <Text style={styles.toastText}>{toastMessage}</Text>
                        </View>
                    </Animated.View>
                )}

                <CustomerBottomNav activeTab={activeTab} setActiveTab={handleTabChange} />

                {showFromPicker && (
                    <DateTimePicker
                        value={fromDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={onFromDateChange}
                        positiveButton={{ label: 'Set', textColor: '#2563EB' }}
                        negativeButton={{ label: 'Clear', textColor: '#EF4444' }}
                    />
                )}
                {showToPicker && (
                    <DateTimePicker
                        value={toDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={onToDateChange}
                        positiveButton={{ label: 'Set', textColor: '#2563EB' }}
                        negativeButton={{ label: 'Clear', textColor: '#EF4444' }}
                    />
                )}
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: { marginRight: 10, marginLeft: -10, marginTop: -10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: -10 },

    scrollContent: { padding: 16, paddingBottom: 40 },

    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },

    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    label: { fontSize: 14, color: '#111827', width: 80, fontWeight: 'bold' },
    value: { fontSize: 14, color: '#111827', flex: 1 },

    codeBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    codeText: { fontSize: 12, fontWeight: 'bold', color: '#374151' },

    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 }
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
    historyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    historyCount: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    emptyStateBox: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'solid',
    },
    emptyText: {
        fontSize: 15,
        color: '#9CA3AF',
        marginTop: 12,
        fontWeight: '500',
    },
    customerNameMain: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    customerPhone: { fontSize: 14, color: '#6B7280', marginBottom: 20 },

    balanceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    balanceLabel: { fontSize: 14, color: '#111827', marginTop: 4 },
    balanceRight: { alignItems: 'flex-end' },
    balanceAmount: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    textRed: { color: '#DC2626' },
    textGreen: { color: '#059669' },

    creditBadge: { backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
    creditText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 }
    },

    flatTransactionRow: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    txHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    txBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    txBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    txAmountSection: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontSize: 22,
        fontWeight: '700',
    },
    txAmountLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    txDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    txDate: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 6,
    },
    itemsSection: {
        backgroundColor: '#F0F7FF',
        padding: 12,
        borderRadius: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#E1EEFF',
    },
    itemsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    itemsTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E40AF',
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    itemInfo: { flex: 1 },
    itemName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    itemPrice: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    itemQtySection: {
        alignItems: 'flex-end',
    },
    qtyBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 4,
    },
    qtyBadgeText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    itemSubtotalValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2563EB',
    },
    itemsSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingHorizontal: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E1EEFF',
    },
    summaryText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E40AF',
    },
    paymentStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        padding: 12,
        borderRadius: 10,
        marginTop: 12,
        gap: 8,
        alignSelf: 'flex-start',
    },
    paymentStatusText: {
        fontSize: 13,
        color: '#059669',
        fontWeight: '500',
    },
    dropdownOptions: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        marginTop: 4,
        zIndex: 100,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    dropdownOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        justifyContent: 'space-between',
    },
    dropdownOptionActive: {
        backgroundColor: '#EFF6FF',
    },
    dropdownOptionText: {
        fontSize: 14,
        color: '#374151',
    },
    dropdownOptionTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },

    // Toast notification styles
    toastContainer: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        zIndex: 999,
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

    // Pagination styles
    paginationCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, borderWidth: 1, borderColor: '#F3F4F6' },
    paginationTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    paginationInfo: { fontSize: 12, color: '#6B7280' },
    paginationShowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, position: 'relative', zIndex: 10 },
    paginationShowLabel: { fontSize: 12, color: '#6B7280' },
    perPageDropdown: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
    perPageDropdownText: { fontSize: 12, color: '#111827', fontWeight: '500' },
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

export default ShopLedgerDetailScreen;

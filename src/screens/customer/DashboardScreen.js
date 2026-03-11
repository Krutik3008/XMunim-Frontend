// Customer Dashboard Screen - Matching reference design
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Platform,
    Animated,
    Image,
    Linking,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { customerDashboardAPI } from '../../api';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import CustomerHeader from '../../components/customer/CustomerHeader';
import CustomerBottomNav from '../../components/customer/CustomerBottomNav';
import { LinearGradient } from 'expo-linear-gradient';
import { Skeleton } from '../../components/ui';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import ShopLedgerDetailScreen from './ShopLedgerDetailScreen';
import { colors, shadows } from '../../theme';
import Constants from 'expo-constants';
import { saveFileToDevice } from '../../utils/downloadHelper';

// Shared saveFileToDevice removed - now using utils/downloadHelper.js

// Utility function moved to downloadHelper.js

const CustomerDashboardScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout, switchRole } = useAuth();
    const [activeTab, setActiveTab] = useState('ledger');
    const [ledgerData, setLedgerData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [selectedShopLedger, setSelectedShopLedger] = useState(null);


    // Filters & Export State
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);
    const [showFromDatePicker, setShowFromDatePicker] = useState(false);
    const [showToDatePicker, setShowToDatePicker] = useState(false);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [selectedShopId, setSelectedShopId] = useState('all');
    const [showShopFilterDropdown, setShowShopFilterDropdown] = useState(false);
    const [transactionType, setTransactionType] = useState('all');
    const [showTypeFilterDropdown, setShowTypeFilterDropdown] = useState(false);

    // History pagination state
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPerPage, setHistoryPerPage] = useState(10);
    const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [toastType, setToastType] = useState('success');
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef(null);

    const showToast = (message, type = 'success') => {
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



    useFocusEffect(
        useCallback(() => {
            if (route.params?.tab) {
                setActiveTab(route.params.tab);
            }
            if (route.params?.successMessage) {
                showToast(route.params.successMessage);
            }

            // Clear all params after processing
            if (route.params?.tab || route.params?.successMessage) {
                navigation.setParams({ tab: undefined, successMessage: undefined });
            }
        }, [route.params?.tab, route.params?.successMessage])
    );

    useEffect(() => {
        loadLedger();
    }, []);

    const loadLedger = async () => {
        try {
            const response = await customerDashboardAPI.getLedger();
            setLedgerData(response.data || []);
        } catch (error) {
            showToast(`Load data error: ${error.message || 'Network Error'}`, 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadLedger();
    };

    const handleRoleSwitch = async (role) => {
        setShowRoleDropdown(false);
        if (role !== user?.active_role) {
            const result = await switchRole(role);
            if (result.success) {
                const message = `Role switched to ${role === 'shop_owner' ? 'Shop Owner' : 'Admin'}`;
                if (role === 'shop_owner') {
                    navigation.reset({ index: 0, routes: [{ name: 'ShopOwnerDashboard', params: { successMessage: message } }] });
                } else if (role === 'admin') {
                    navigation.reset({ index: 0, routes: [{ name: 'AdminPanel', params: { successMessage: message } }] });
                }
            } else {
                showToast(result.message || 'Role switch failed', 'error');
            }
        }
    };

    const formatCurrency = (amount, type) => {
        const value = Math.abs(amount || 0).toFixed(2);
        const prefix = type === 'debit' ? '-' : '+';
        return `${prefix}₹${value}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
        return `${day} ${month}, ${time}`;
    };

    // Calculate summary stats
    const getSummaryStats = () => {
        const totalShops = ledgerData.length;
        let totalOwed = 0;
        let netBalance = 0;

        ledgerData.forEach(item => {
            const balance = item.customer?.balance || 0;
            if (balance < 0) {
                totalOwed += Math.abs(balance);
            }
            netBalance += balance;
        });

        return { totalShops, totalOwed, netBalance };
    };

    const stats = getSummaryStats();

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

    const getAllTransactions = () => {
        return ledgerData.reduce((acc, shop) => {
            if (shop.transactions) {
                const shopTx = shop.transactions.map(tx => ({ ...tx, shopName: shop.shop?.name, shopLocation: shop.shop?.location, shopId: shop.shop?.id }));
                return [...acc, ...shopTx];
            }
            return acc;
        }, []).sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    const getFilteredTransactions = () => {
        let transactions = getAllTransactions();
        if (dateFrom) {
            const fromStart = new Date(dateFrom);
            fromStart.setHours(0, 0, 0, 0);
            transactions = transactions.filter(t => new Date(t.date) >= fromStart);
        }
        if (dateTo) {
            const toEnd = new Date(dateTo);
            toEnd.setHours(23, 59, 59, 999);
            transactions = transactions.filter(t => new Date(t.date) <= toEnd);
        }
        if (selectedShopId !== 'all') {
            transactions = transactions.filter(t => t.shopId === selectedShopId);
        }
        if (transactionType !== 'all') {
            if (transactionType === 'credit') {
                transactions = transactions.filter(t => t.type === 'credit');
            } else if (transactionType === 'payment') {
                transactions = transactions.filter(t => t.type === 'debit' || t.type === 'payment');
            }
        }
        return transactions;
    };

    const exportToPDF = async () => {
        if (selectedShopId === 'all') {
            showToast('Please select a particular shop to download', 'error');
            return;
        }
        try {
            const transactions = getFilteredTransactions();
            const now = new Date();
            const generatedDate = `${now.toLocaleDateString('en-GB')} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

            // Calculate stats specifically for the filtered transactions
            const totalCredits = transactions.filter(t => t.type === 'credit').length;
            const totalCreditsAmount = transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
            const totalPayments = transactions.filter(t => t.type === 'debit' || t.type === 'payment').length;
            const totalPaymentsAmount = transactions.filter(t => t.type === 'debit' || t.type === 'payment').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
            const totalItems = transactions.reduce((sum, t) => {
                const items = t.products || t.items || [];
                return sum + items.reduce((itemSum, p) => itemSum + (p.quantity || 1), 0);
            }, 0);

            // Get selected shop info
            const shopInfo = ledgerData.find(item => item.shop?.id === selectedShopId)?.shop;
            const shopBalance = ledgerData.find(item => item.shop?.id === selectedShopId)?.customer?.balance || 0;

            const txRows = transactions.map(t => {
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
                    <div class="generated">${dateFrom || dateTo ? `Period: ${dateFrom ? formatDateDisplay(dateFrom) : 'Beginning'} to ${dateTo ? formatDateDisplay(dateTo) : 'Today'}` : 'Period: Full History'}</div>
                    <div class="generated">Generated on: ${generatedDate}</div>
                </div>

                <div class="section">
                    <div class="section-title"><span>🏪</span> Shop Information</div>
                    <div class="info-row"><b>Shop Name:</b> ${shopInfo?.name || 'N/A'}</div>
                    <div class="info-row"><b>Location:</b> ${shopInfo?.location || 'N/A'}</div>
                </div>

                <div class="section">
                    <div class="section-title"><span>👤</span> Personal Information</div>
                    <div class="info-row"><b>Name:</b> ${user?.name || 'Customer'}</div>
                    <div class="info-row"><b>Phone:</b> +91 ${user?.phone || 'N/A'}</div>
                    <div class="info-row"><b>Current Balance:</b> ${shopBalance !== 0 ? (shopBalance > 0 ? '+' : '-') : ''}₹${Math.abs(shopBalance || 0).toFixed(2)}</div>
                    <div class="info-row"><b>Status:</b> ${shopBalance > 0 ? 'Credit' : (shopBalance < 0 ? 'Dues' : 'Clear')}</div>
                </div>

                <div class="analytics">
                    <div class="analytics-box">
                        <div class="label">Total Transactions</div>
                        <div class="value blue">${transactions.length}</div>
                    </div>
                    <div class="analytics-box">
                        <div class="label">Credit Taken</div>
                        <div class="value red">${totalCredits}</div>
                        <div class="sub">₹${totalCreditsAmount.toFixed(2)}</div>
                    </div>
                    <div class="analytics-box">
                        <div class="label">Payments Made</div>
                        <div class="value green">${totalPayments}</div>
                        <div class="sub">₹${totalPaymentsAmount.toFixed(2)}</div>
                    </div>
                    <div class="analytics-box">
                        <div class="label">Items Purchased</div>
                        <div class="value blue">${totalItems}</div>
                    </div>
                </div>

                <table>
                    <tr><th>Date</th><th>Type</th><th>Items</th><th>Qty</th><th>Amount</th><th>Note</th></tr>
                    ${txRows}
                </table>
                <div class="footer">
                    Report generated via ShopMunim App
                </div>
            </body></html>`;

            const { uri } = await Print.printToFileAsync({ html });
            const fileName = `My_Report_${shopInfo?.name || 'Shop'}.pdf`;
            const fileUri = FileSystem.cacheDirectory + fileName;
            await FileSystem.moveAsync({ from: uri, to: fileUri });

            if (Platform.OS === 'android') {
                const base64Content = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
                const result = await saveFileToDevice(fileName, base64Content, 'application/pdf');
                if (result.success) {
                    showToast('Download Successful');
                }
            } else {
                // iOS: save via helper
                const base64Content = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
                const result = await saveFileToDevice(fileName, base64Content, 'application/pdf');
                if (result.success) {
                    showToast('Download Successful');
                }
            }
        } catch (error) {
            console.error('PDF export error:', error);
            alert('Failed to generate PDF');
        }
    };

    const exportToExcel = async () => {
        if (selectedShopId === 'all') {
            showToast('Please select a particular shop to download', 'error');
            return;
        }
        try {
            const transactions = getFilteredTransactions();
            const shopInfo = ledgerData.find(item => item.shop?.id === selectedShopId)?.shop;




            const now = new Date();
            const reportDate = formatDateDisplay(now);

            const rows = [];
            rows.push(['My Transaction Report']);
            rows.push([`Shop: ${shopInfo?.name || 'N/A'}`]);
            rows.push([`Location: ${shopInfo?.location || 'N/A'}`]);
            rows.push([]);
            rows.push([`Customer: ${user?.name || 'Customer'} (${user?.phone || 'N/A'})`]);
            rows.push([`Report Generated: ${reportDate}`]);
            rows.push([`Period: ${dateFrom || dateTo ? `${dateFrom ? formatDateDisplay(dateFrom) : 'Beginning'} to ${dateTo ? formatDateDisplay(dateTo) : 'Today'}` : 'Full History'}`]);
            rows.push([]);

            rows.push(['Date', 'Type', 'Items', 'Quantity', 'Amount', 'Note']);

            transactions.forEach(t => {
                const isPay = t.type === 'debit' || t.type === 'payment' || t.type === 'CREDIT';
                const items = t.products || t.items || [];
                const itemNames = items.map(i => i.name || 'Item').join(', ') || '';
                const totalQty = items.length > 0 ? items.reduce((s, i) => s + (i.quantity || 1), 0) : '';

                rows.push([
                    formatDate(t.date),
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

            const fileName = `My_Report_${shopInfo?.name || 'Shop'}.xlsx`;
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
            console.error('Excel export error:', error);
            alert('Failed to generate Excel');
        }
    };


    // Summary Stats Cards for Ledger Tab
    const SummaryStatsCards = () => {
        const isOwed = (stats.totalOwed || 0) > 0;

        return (
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statEmoji}>🏪</Text>
                    <Text style={styles.statValue}>{stats.totalShops}</Text>
                    <Text style={styles.statLabel}>Shops</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.rupeeCircle, !isOwed && { backgroundColor: '#F3F4F6' }]}>
                        <FontAwesome name="rupee" size={18} color={isOwed ? "#EF4444" : "#333"} />
                    </View>
                    <Text
                        style={[styles.statValue, isOwed && styles.statValueRed]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                    >
                        ₹{Math.abs(stats.totalOwed || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    </Text>
                    <Text style={styles.statLabel}>Total Dues</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statEmoji}>📊</Text>
                    <Text
                        style={styles.statValue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                    >
                        {stats.netBalance < 0 ? '-' : ''}₹{Math.abs(stats.netBalance || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    </Text>
                    <Text style={styles.statLabel}>Net Balance</Text>
                </View>
            </View>
        );
    };

    // Empty State Component for Ledger
    const LedgerEmptyState = () => (
        <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Welcome to ShopMunim!</Text>
            <Text style={styles.emptyDescription}>
                No shop records found. Visit shops that use{'\n'}ShopMunim to see your ledger here.
            </Text>
            <View style={styles.chartIconContainer}>
                <View style={styles.chartIcon}>
                    <View style={[styles.chartBar, { height: 30, backgroundColor: '#EC4899' }]} />
                    <View style={[styles.chartBar, { height: 45, backgroundColor: '#3B82F6' }]} />
                    <View style={[styles.chartBar, { height: 35, backgroundColor: '#10B981' }]} />
                </View>
            </View>
            <Text style={styles.emptyHint}>
                Shop owners can add you as a customer to{'\n'}track your purchases and payments.
            </Text>
        </View>
    );

    // Ledger Tab Content
    const LedgerContent = () => (
        <ScrollView
            style={styles.tabContent}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {loading ? (
                <>
                    <View style={styles.statsContainer}>
                        {[1, 2, 3].map(i => (
                            <View key={i} style={styles.statCard}>
                                <Skeleton width={24} height={24} borderRadius={12} style={{ marginBottom: 8 }} />
                                <Skeleton width="60%" height={24} style={{ marginBottom: 4 }} />
                                <Skeleton width="40%" height={12} />
                            </View>
                        ))}
                    </View>
                    <View style={styles.ledgerList}>
                        {[1, 2, 3].map(i => (
                            <View key={i} style={[styles.ledgerItemContainer, { padding: 16 }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View style={{ flex: 1 }}>
                                        <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />
                                        <Skeleton width="40%" height={12} style={{ marginBottom: 12 }} />
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Skeleton width={40} height={18} borderRadius={4} style={{ marginRight: 8 }} />
                                            <Skeleton width={60} height={18} />
                                        </View>
                                    </View>
                                    <Skeleton width={36} height={36} borderRadius={18} />
                                </View>
                            </View>
                        ))}
                    </View>
                </>
            ) : ledgerData.length === 0 ? (
                <LedgerEmptyState />
            ) : (
                <>
                    <SummaryStatsCards />
                    <View style={styles.ledgerList}>
                        {ledgerData.map((item, index) => (
                            <View key={index} style={styles.ledgerItemContainer}>
                                <View style={styles.ledgerItemHeader}>
                                    <View style={styles.ledgerInfo}>
                                        <Text style={styles.shopName}>{item.shop?.name}</Text>
                                        <Text style={styles.shopLocation}>{item.shop?.location}</Text>

                                        {(() => {
                                            const balance = item.customer?.balance || 0;
                                            let badgeStyle = styles.badgeClear;
                                            let textStyle = styles.badgeClearText;
                                            let label = "Clear";
                                            let amountColor = '#374151';

                                            if (balance < 0) {
                                                badgeStyle = styles.badgeOwe;
                                                textStyle = styles.badgeOweText;
                                                label = "Dues";
                                                amountColor = '#EF4444';
                                            } else if (balance > 0) {
                                                badgeStyle = styles.badgeCredit;
                                                textStyle = styles.badgeCreditText;
                                                label = "Credit";
                                                amountColor = '#111827';
                                            }

                                            return (
                                                <View style={styles.ledgerBalanceRow}>
                                                    <View style={[styles.statusBadge, badgeStyle]}>
                                                        <Text style={[styles.statusBadgeText, textStyle]}>{label}</Text>
                                                    </View>
                                                    <Text style={[styles.ledgerBalanceAmount, { color: amountColor }]}>
                                                        {balance < 0 ? '-' : ''}₹{Math.abs(balance).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                                    </Text>
                                                </View>
                                            );
                                        })()}
                                    </View>

                                    <TouchableOpacity
                                        style={styles.ledgerArrow}
                                        activeOpacity={0.7}
                                        onPress={() => setSelectedShopLedger(item)}
                                    >
                                        <Ionicons
                                            name="arrow-forward"
                                            size={18}
                                            color="#FFF"
                                        />
                                    </TouchableOpacity>
                                </View>


                            </View>
                        ))}
                    </View>
                </>
            )}
            {/* Spacer for bottom nav */}
            <View style={{ height: 50 }} />
        </ScrollView>
    );

    // UPI Payment Handler
    const handlePayNow = async (item) => {
        const upiId = item.shop?.upi_id;
        const shopName = item.shop?.name || 'Shop';
        const amount = Math.abs(item.customer?.balance || 0).toFixed(2);

        if (!upiId) {
            showToast('UPI not available for this shop');
            return;
        }

        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Payment to ${shopName}`)}`;

        try {
            const supported = await Linking.canOpenURL(upiUrl);
            if (supported) {
                await Linking.openURL(upiUrl);
            } else {
                showToast('No UPI app found on this device');
            }
        } catch (error) {
            console.error('UPI payment error:', error);
            showToast('Failed to open UPI app');
        }
    };

    // Payments Tab Content - Matching reference design
    const PaymentsContent = () => {
        if (loading) {
            return (
                <View style={styles.tabContent}>
                    <Skeleton width="40%" height={24} style={{ marginHorizontal: 20, marginTop: 20, marginBottom: 8 }} />
                    <Skeleton width="30%" height={18} style={{ marginHorizontal: 20, marginBottom: 20 }} />
                    {[1, 2].map(i => (
                        <View key={i} style={[styles.paymentCard, { padding: 16 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1 }}>
                                    <Skeleton width="50%" height={18} style={{ marginBottom: 8 }} />
                                    <Skeleton width="40%" height={12} style={{ marginBottom: 12 }} />
                                    <Skeleton width="30%" height={16} />
                                </View>
                                <Skeleton width={80} height={36} borderRadius={18} />
                            </View>
                        </View>
                    ))}
                </View>
            );
        }

        if (ledgerData.length === 0) {
            return (
                <View style={styles.tabContent}>
                    <LedgerEmptyState />
                </View>
            );
        }

        const pendingPayments = ledgerData.filter(item => (item.customer?.balance || 0) < 0);

        return (
            <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: (showShopFilterDropdown || showTypeFilterDropdown) ? 100 : 80 }}>

                <Text style={styles.sectionTitle}>Payment Center</Text>
                <Text style={styles.sectionSubtitle}>Pending Payments</Text>

                {pendingPayments.length > 0 ? (
                    <View style={styles.pendingList}>
                        {pendingPayments.map((item, index) => (
                            <View key={index} style={styles.paymentCard}>
                                <View style={styles.paymentCardContent}>
                                    <View style={styles.paymentInfo}>
                                        <Text style={styles.paymentShopName}>{item.shop?.name}</Text>
                                        <Text style={styles.paymentShopLocation}>{item.shop?.location}</Text>
                                        <Text style={styles.paymentOweText}>Dues: ₹{Math.abs(item.customer?.balance || 0).toFixed(2)}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.paymentPayBtn} onPress={() => handlePayNow(item)}>
                                        <Text style={styles.paymentPayBtnText}>Pay Now</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.pendingPaymentsCard}>
                        <View style={styles.checkmarkCircle}>
                            <Ionicons name="checkmark" size={40} color="#fff" />
                        </View>
                        <Text style={styles.pendingPaymentsText}>No pending payments</Text>
                        <Text style={styles.pendingPaymentsSubtext}>All dues are cleared!</Text>
                    </View>
                )}

                {/* Filter & Export Section */}
                <View style={[styles.filterExportCard, { marginBottom: 20 }]}>
                    <View style={styles.filterHeader}>
                        <View style={styles.filterTitleRow}>
                            <Ionicons name="filter-outline" size={18} color="#374151" />
                            <Text style={styles.filterSectionTitle}>Filters & Export</Text>
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


                    {/* Shop Filter */}
                    <View style={[styles.typeFilterContainer, { marginTop: 12 }]}>
                        <Text style={styles.filterLabel}>Filter by Shop</Text>
                        <TouchableOpacity
                            style={styles.typeDropdown}
                            onPress={() => { setShowShopFilterDropdown(!showShopFilterDropdown); setShowTypeFilterDropdown(false); }}
                        >
                            <Text style={styles.typeDropdownText}>
                                {selectedShopId === 'all'
                                    ? 'All Shops'
                                    : ledgerData.find(item => item.shop?.id === selectedShopId)?.shop?.name || 'Selected'}
                            </Text>
                            <Ionicons name={showShopFilterDropdown ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" />
                        </TouchableOpacity>

                        {showShopFilterDropdown && (
                            <ScrollView
                                style={{ maxHeight: 176, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginTop: 6 }}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                            >
                                <TouchableOpacity
                                    style={[styles.customerDetailDropdownOption, selectedShopId === 'all' && styles.customerDetailDropdownOptionActive]}
                                    onPress={() => { setSelectedShopId('all'); setShowShopFilterDropdown(false); }}
                                >
                                    <Text style={[styles.customerDetailDropdownOptionText, selectedShopId === 'all' && styles.customerDetailDropdownOptionTextActive]}>All Shops</Text>
                                    {selectedShopId === 'all' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                </TouchableOpacity>
                                {ledgerData.map((item) => (
                                    <TouchableOpacity
                                        key={item.shop?.id}
                                        style={[styles.customerDetailDropdownOption, selectedShopId === item.shop?.id && styles.customerDetailDropdownOptionActive]}
                                        onPress={() => { setSelectedShopId(item.shop?.id); setShowShopFilterDropdown(false); }}
                                    >
                                        <Text style={[styles.customerDetailDropdownOptionText, selectedShopId === item.shop?.id && styles.customerDetailDropdownOptionTextActive]}>
                                            {item.shop?.name}
                                        </Text>
                                        {selectedShopId === item.shop?.id && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    {/* Transaction Type Filter */}
                    <View style={[styles.typeFilterContainer, { marginTop: 12 }]}>
                        <Text style={styles.filterLabel}>Transaction Type</Text>
                        <TouchableOpacity
                            style={styles.typeDropdown}
                            onPress={() => { setShowTypeFilterDropdown(!showTypeFilterDropdown); setShowShopFilterDropdown(false); }}
                        >
                            <Text style={styles.typeDropdownText}>
                                {transactionType === 'all' ? 'All Transactions' : transactionType === 'credit' ? 'Credits Only' : 'Payments Only'}
                            </Text>
                            <Ionicons name={showTypeFilterDropdown ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" />
                        </TouchableOpacity>

                        {showTypeFilterDropdown && (
                            <ScrollView
                                style={{ maxHeight: 176, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginTop: 6 }}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                            >
                                <TouchableOpacity
                                    style={[styles.customerDetailDropdownOption, transactionType === 'all' && styles.customerDetailDropdownOptionActive]}
                                    onPress={() => { setTransactionType('all'); setShowTypeFilterDropdown(false); }}
                                >
                                    <Text style={[styles.customerDetailDropdownOptionText, transactionType === 'all' && styles.customerDetailDropdownOptionTextActive]}>All Transactions</Text>
                                    {transactionType === 'all' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.customerDetailDropdownOption, transactionType === 'credit' && styles.customerDetailDropdownOptionActive]}
                                    onPress={() => { setTransactionType('credit'); setShowTypeFilterDropdown(false); }}
                                >
                                    <Text style={[styles.customerDetailDropdownOptionText, transactionType === 'credit' && styles.customerDetailDropdownOptionTextActive]}>Credits Only</Text>
                                    {transactionType === 'credit' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.customerDetailDropdownOption, transactionType === 'payment' && styles.customerDetailDropdownOptionActive]}
                                    onPress={() => { setTransactionType('payment'); setShowTypeFilterDropdown(false); }}
                                >
                                    <Text style={[styles.customerDetailDropdownOptionText, transactionType === 'payment' && styles.customerDetailDropdownOptionTextActive]}>Payments Only</Text>
                                    {transactionType === 'payment' && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>

                <View style={{ height: 50 }} />
            </ScrollView >
        );
    };

    // History Tab Content - Matching reference design
    const HistoryContent = () => {

        if (loading) {
            return <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />;
        }

        if (ledgerData.length === 0) {
            return (
                <View style={styles.tabContent}>
                    <LedgerEmptyState />
                </View>
            );
        }

        // Flatten and sort transactions
        const allTransactions = ledgerData.reduce((acc, shop) => {
            if (shop.transactions) {
                const shopTx = shop.transactions.map(tx => ({ ...tx, shopName: shop.shop?.name }));
                return [...acc, ...shopTx];
            }
            return acc;
        }, []).sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allTransactions.length === 0) {
            return (
                <View style={styles.tabContent}>
                    <View style={styles.historyEmptyCard}>
                        <Text style={styles.historyEmoji}>📋</Text>
                        <Text style={styles.historyEmptyTitle}>No transaction history</Text>
                        <Text style={styles.historyEmptySubtext}>Your transactions will appear here</Text>
                    </View>
                </View>
            );
        }

        return (
            <ScrollView
                style={styles.tabContent}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                onScrollBeginDrag={() => setShowPerPageDropdown(false)}
            >
                <View style={[styles.titleWithBadge, { justifyContent: 'space-between' }]}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Transaction History</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{allTransactions.length}</Text>
                    </View>
                </View>
                <View style={styles.historyList}>
                    {(() => {
                        const totalItems = allTransactions.length;
                        const totalPages = Math.ceil(totalItems / historyPerPage);
                        const startIdx = (historyPage - 1) * historyPerPage;
                        const endIdx = Math.min(startIdx + historyPerPage, totalItems);
                        const paginatedTx = allTransactions.slice(startIdx, endIdx);

                        return (
                            <>
                                {paginatedTx.map((tx, index) => (
                                    <View key={index} style={styles.historyCard}>
                                        <View style={styles.historyTopRow}>
                                            <View style={styles.historyLeftCol}>
                                                <Text style={styles.historyShopName}>{tx.shopName}</Text>
                                                <Text style={styles.historyDate}>{formatDate(tx.date)}</Text>
                                            </View>
                                            <View style={styles.historyRightCol}>
                                                <Text style={[
                                                    styles.historyAmount,
                                                    tx.type === 'debit' ? styles.textGreen : styles.textRed
                                                ]}>
                                                    {formatCurrency(tx.amount, tx.type)}
                                                </Text>
                                                <View style={[styles.historyBadge, tx.type === 'debit' ? styles.badgeBlack : styles.badgeRed]}>
                                                    <Text style={styles.historyBadgeText}>
                                                        {tx.type === 'debit' ? 'Payment Made' : 'Credit Taken'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        {tx.products && tx.products.length > 0 && (
                                            <View style={styles.historyItemsContainer}>
                                                <Text style={styles.historyLabel}>Items: </Text>
                                                <Text style={styles.historyValue}>
                                                    {tx.products.map(p => `${p.product?.name || p.name || 'Item'} x${p.quantity} (₹${p.price || 0})`).join(', ')}
                                                </Text>
                                            </View>
                                        )}
                                        {tx.note ? (
                                            <View style={styles.historyNoteRow}>
                                                <Text style={styles.historyLabel}>Note: </Text>
                                                <Text style={styles.historyValue}>{tx.note}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                ))}

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
                                                    <Text style={styles.perPageDropdownText}>{historyPerPage}</Text>
                                                    <Ionicons name={showPerPageDropdown ? 'chevron-up' : 'chevron-down'} size={14} color="#6B7280" />
                                                </TouchableOpacity>
                                                {showPerPageDropdown && (
                                                    <View style={styles.perPageDropdownOptions}>
                                                        {[5, 10, 25, 50].map(val => (
                                                            <TouchableOpacity
                                                                key={val}
                                                                style={[styles.perPageOption, historyPerPage === val && styles.perPageOptionActive]}
                                                                onPress={() => { setHistoryPerPage(val); setHistoryPage(1); setShowPerPageDropdown(false); }}
                                                            >
                                                                <Text style={[styles.perPageOptionText, historyPerPage === val && styles.perPageOptionTextActive]}>{val}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <View style={styles.paginationBottomRow}>
                                            <TouchableOpacity
                                                style={[styles.paginationBtn, historyPage <= 1 && styles.paginationBtnDisabled]}
                                                onPress={() => { if (historyPage > 1) setHistoryPage(historyPage - 1); }}
                                                disabled={historyPage <= 1}
                                            >
                                                <Ionicons name="chevron-back" size={14} color={historyPage <= 1 ? '#D1D5DB' : '#374151'} />
                                                <Text style={[styles.paginationBtnText, historyPage <= 1 && styles.paginationBtnTextDisabled]}>Previous</Text>
                                            </TouchableOpacity>
                                            <View style={styles.paginationCenter}>
                                                <Text style={styles.paginationPageLabel}>Page</Text>
                                                <Text style={styles.paginationPageNum}>{historyPage} of {totalPages}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.paginationBtn, historyPage >= totalPages && styles.paginationBtnDisabled]}
                                                onPress={() => { if (historyPage < totalPages) setHistoryPage(historyPage + 1); }}
                                                disabled={historyPage >= totalPages}
                                            >
                                                <Text style={[styles.paginationBtnText, historyPage >= totalPages && styles.paginationBtnTextDisabled]}>Next</Text>
                                                <Ionicons name="chevron-forward" size={14} color={historyPage >= totalPages ? '#D1D5DB' : '#374151'} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </>
                        );
                    })()}
                </View>
                <View style={{ height: 25 }} />
            </ScrollView >
        );
    };

    // Account Tab Content - Matching reference exactly
    const AccountContent = () => {
        const handleLogout = () => {
            Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Logout', style: 'destructive', onPress: logout }
                ]
            );
        };

        return (
            <ScrollView style={styles.tabContent} contentContainerStyle={styles.accountScrollContent}>
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <LinearGradient
                        colors={['#8B5CF6', '#6366F1']}
                        style={styles.profileAccent}
                    />
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarBorder}>
                            <View style={styles.avatar}>
                                {user?.profile_photo ? (
                                    <Image
                                        source={{ uri: `data:image/jpeg;base64,${user.profile_photo}` }}
                                        style={{ width: 60, height: 60, borderRadius: 30 }}
                                    />
                                ) : (
                                    <Ionicons name="person" size={30} color="#8B5CF6" />
                                )}
                            </View>
                        </View>

                        <View style={styles.profileInfo}>
                            <Text style={styles.profileNamePrimary} numberOfLines={1}>{user?.name || 'User'}</Text>
                            <Text style={styles.profilePhoneText}>+91 {user?.phone}</Text>
                        </View>

                        <View style={styles.rightRoleBadge}>
                            <Text style={styles.rightRoleBadgeText}>User</Text>
                        </View>
                    </View>
                </View>

                {/* Account Settings */}
                <View style={styles.settingsCard}>
                    <Text style={styles.settingsTitle}>Account Settings</Text>

                    <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('EditProfile')}>
                        <Ionicons name="person-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                        <Text style={styles.settingText}>Profile Info</Text>
                        <Ionicons name="create-outline" size={18} color="#6B7280" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Notifications')}>
                        <Ionicons name="notifications-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                        <Text style={styles.settingText}>Notifications</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.settingItem, styles.settingItem]} onPress={() => navigation.navigate('PrivacySecurity')}>
                        <Ionicons name="lock-closed-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                        <Text style={styles.settingText}>Privacy & Security</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('HelpSupport')}>
                        <Ionicons name="help-circle-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                        <Text style={styles.settingText}>Help & Support</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('About')}>
                        <Ionicons name="information-circle-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                        <Text style={styles.settingText}>About ShopMunim</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.settingItem, styles.settingItemLast]} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={22} color="#EF4444" style={{ marginRight: 12 }} />
                        <Text style={[styles.settingText, styles.logoutText]}>Logout</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerBrand}>ShopMunim</Text>
                    <Text style={styles.footerVersion}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
                    <Text style={styles.footerTagline}>Digital Credit & Payment Ledger</Text>
                    <Text style={styles.footerCopyright}>©2026 DEC24 INNOVATIONS PVT LTD. All Rights Reserved.</Text>

                </View>
            </ScrollView>
        );
    };

    // Services Tab Content (New)
    const ServicesContent = () => {
        const servicesData = ledgerData.filter(item =>
            item.customer?.type === 'services' || item.customer?.type === 'staff'
        );

        return (
            <ScrollView
                style={styles.tabContent}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {loading ? (
                    <View style={styles.ledgerList}>
                        {[1, 2].map(i => (
                            <View key={i} style={[styles.ledgerItemContainer, { padding: 16 }]}>
                                <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />
                                <Skeleton width="40%" height={12} style={{ marginBottom: 12 }} />
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Skeleton width={80} height={24} borderRadius={12} />
                                    <Skeleton width={80} height={24} borderRadius={12} />
                                </View>
                            </View>
                        ))}
                    </View>
                ) : servicesData.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>No Services Active</Text>
                        <Text style={styles.emptyDescription}>
                            You are not currently enrolled in any{'\n'}services or staff attendance programs.
                        </Text>
                        <View style={styles.chartIconContainer}>
                            <Ionicons name="calendar-outline" size={80} color="#E5E7EB" />
                        </View>
                    </View>
                ) : (
                    <View style={styles.ledgerList}>
                        {servicesData.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.ledgerItemContainer}
                                onPress={() => navigation.navigate('ServiceLedgerDetail', {
                                    customer: item.customer,
                                    shopId: item.shop?.id,
                                    shopDetails: item.shop
                                })}
                            >
                                <View style={styles.ledgerItemHeader}>
                                    <View style={styles.ledgerInfo}>
                                        <Text style={styles.shopName}>{item.shop?.name}</Text>
                                        <Text style={styles.shopLocation}>{item.shop?.location}</Text>

                                        <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                                            <View style={[styles.statusBadge, { backgroundColor: '#F3F4F6' }]}>
                                                <Text style={[styles.statusBadgeText, { color: '#4B5563' }]}>
                                                    {item.customer?.type === 'staff' ? 'Staff' : 'Service'}
                                                </Text>
                                            </View>
                                            <View style={[styles.statusBadge, { backgroundColor: '#EBF5FF' }]}>
                                                <Text style={[styles.statusBadgeText, { color: '#3B82F6' }]}>
                                                    {item.customer?.service_rate_type === 'hourly' ? 'Hourly' : 'Daily'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.ledgerArrow}
                                        activeOpacity={0.7}
                                        onPress={() => navigation.navigate('ServiceLedgerDetail', {
                                            customer: item.customer,
                                            shopId: item.shop?.id,
                                            shopDetails: item.shop
                                        })}
                                    >
                                        <Ionicons
                                            name="arrow-forward"
                                            size={18}
                                            color="#FFF"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        );
    };

    // Render active tab content
    const renderContent = () => {
        switch (activeTab) {
            case 'ledger': return <LedgerContent />;
            case 'services': return <ServicesContent />;
            case 'payments': return <PaymentsContent />;
            case 'history': return HistoryContent();
            case 'account': return <AccountContent />;
            default: return <LedgerContent />;
        }
    };



    console.log('Rendering CustomerDashboard', { activeTab, ledgerDataLength: ledgerData.length });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <CustomerHeader
                user={user}
                logout={logout}
                showRoleDropdown={showRoleDropdown}
                setShowRoleDropdown={setShowRoleDropdown}
                handleRoleSwitch={handleRoleSwitch}
            />
            <View style={styles.content}>{renderContent()}</View>

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
                        <View style={[styles.toastIcon, toastType === 'error' && { backgroundColor: '#EF4444' }]}>
                            <Ionicons name={toastType === 'error' ? "alert-circle" : "checkmark-circle"} size={20} color="#FFFFFF" />
                        </View>
                        <Text style={[styles.toastText, typeof toastMessage === 'string' && toastMessage.toLowerCase().includes('network error') && { paddingHorizontal: 10, flex: 1 }]}>{toastMessage}</Text>
                    </View>
                </Animated.View>
            )}

            <CustomerBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

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
                            // Auto-correct To Date if From > To
                            if (dateTo && selectedDate > dateTo) {
                                setDateTo(selectedDate);
                            }
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
                            // Auto-correct From Date if To < From
                            if (dateFrom && selectedDate < dateFrom) {
                                setDateFrom(selectedDate);
                            }
                        } else if (event.type === 'dismissed') {
                            setDateTo(null);
                        }
                    }}
                    positiveButton={{ label: 'Set', textColor: '#2563EB' }}
                    negativeButton={{ label: 'Clear', textColor: '#EF4444' }}
                />
            )}

            {selectedShopLedger && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: '#fff' }]}>
                    <ShopLedgerDetailScreen
                        customer={selectedShopLedger.customer}
                        shopId={selectedShopLedger.shop?.id}
                        initialShopDetails={selectedShopLedger.shop}
                        initialTransactions={selectedShopLedger.transactions}
                        onBack={() => setSelectedShopLedger(null)}
                        activeTab={activeTab}
                        onTabChange={(tab) => {
                            setActiveTab(tab);
                            setSelectedShopLedger(null);
                        }}
                    />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' }, // Changed background to white as per screenshot often implies cleaner look, but let's keep it clean
    content: { flex: 1, backgroundColor: '#F9FAFB' }, // Content background



    // Tab Content
    tabContent: { flex: 1, padding: 16 },

    // Summary Stats Cards
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
    statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E5E5' },
    statEmoji: { fontSize: 24, marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    statValueRed: { color: '#EF4444' },
    statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
    rupeeCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },

    // Empty State
    emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', marginTop: 8 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
    emptyDescription: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
    chartIconContainer: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, marginVertical: 20 },
    chartIcon: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    chartBar: { width: 20, borderRadius: 4 },
    emptyHint: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },

    // Ledger List
    ledgerList: { gap: 12 },
    ledgerItemContainer: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', overflow: 'hidden' },
    ledgerItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    ledgerInfo: { flex: 1 },
    shopName: { fontSize: 16, fontWeight: '600', color: '#333' },
    shopLocation: { fontSize: 13, color: '#666', marginTop: 2 },

    // Ledger Badges
    ledgerBalanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    statusBadgeText: { fontSize: 12, fontWeight: '700' },
    ledgerBalanceAmount: { fontSize: 18, fontWeight: '700' },
    ledgerArrow: {
        width: 32,
        height: 32,
        backgroundColor: '#4E86F7',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },

    badgeClear: { backgroundColor: '#F3F4F6' },
    badgeClearText: { color: '#374151' },

    badgeCredit: { backgroundColor: '#111827' },
    badgeCreditText: { color: '#fff' },

    badgeOwe: { backgroundColor: '#EF4444' },
    badgeOweText: { color: '#fff' },

    // Transactions Section
    transactionsSection: { padding: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#fff' },

    // Pending Payment Card
    pendingCard: { backgroundColor: '#FFF5F5', borderRadius: 8, padding: 12, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
    pendingTitle: { fontSize: 13, fontWeight: '700', color: '#7F1D1D', marginBottom: 2 },
    pendingSubtitle: { fontSize: 12, color: '#EF4444' },
    payNowButton: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    payNowButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    transactionsTitle: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 12 },
    noTransactionsText: { fontSize: 13, color: '#999', fontStyle: 'italic', marginBottom: 12 },

    transactionRowContainer: { marginBottom: 12, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
    transactionRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    badgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    badgeRed: { backgroundColor: '#EF4444' },
    badgeBlack: { backgroundColor: '#111827' },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    transactionDate: { fontSize: 12, color: '#6B7280' },
    transactionAmount: { fontSize: 14, fontWeight: '700' },
    transactionItems: { fontSize: 13, color: '#374151', marginLeft: 2 },
    textRed: { color: '#EF4444' },
    textGreen: { color: '#10B981' },

    // History List
    historyList: { gap: 16, paddingBottom: 20 },
    historyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E5E5', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },

    // History Top Row
    historyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    historyLeftCol: { flex: 1 },
    historyRightCol: { alignItems: 'flex-end' },

    // History Text Styles
    historyShopName: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    historyDate: { fontSize: 13, color: '#6B7280' },
    historyAmount: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },

    // History Badge
    historyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    historyBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    // History Items Box
    historyItemsContainer: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginTop: 12 },

    // History Note Row
    historyNoteRow: { flexDirection: 'row', marginTop: 12, paddingHorizontal: 4 },

    historyLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
    historyValue: { fontSize: 13, color: '#4B5563', flex: 1 },

    // Section Titles
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16 }, // Added generic margin
    sectionSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },

    // Pending Payments Card
    pendingPaymentsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 32, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#E5E5E5' },
    checkmarkCircle: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    pendingPaymentsText: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
    pendingPaymentsSubtext: { fontSize: 14, color: '#666' },

    // Payment Card (New)
    pendingList: { marginBottom: 20 },
    paymentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E5E5' },
    paymentCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paymentInfo: { flex: 1 },
    paymentShopName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2 },
    paymentShopLocation: { fontSize: 13, color: '#666', marginBottom: 8 },
    paymentOweText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
    paymentPayBtn: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    paymentPayBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },



    // History Empty State
    historyEmptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 48, alignItems: 'center', marginTop: 24 },
    historyEmoji: { fontSize: 48, marginBottom: 16 },
    historyEmptyTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
    historyEmptySubtext: { fontSize: 14, color: '#666' },

    // Profile Card
    profileCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        ...shadows.sm,
    },
    profileAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    avatarBorder: {
        padding: 3,
        borderRadius: 35,
        borderWidth: 1.5,
        borderColor: '#F3E8FF',
        marginRight: 16,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    profileInfo: { flex: 1 },
    profileNamePrimary: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 2 },
    profilePhoneText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
    rightRoleBadge: {
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E9E3FF',
    },
    rightRoleBadgeText: {
        fontSize: 11,
        color: '#8B5CF6',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    modifyBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Settings Card
    settingsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        ...shadows.sm,
    },
    settingsTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginTop: 16, marginBottom: 8, letterSpacing: 0.5 },
    settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    settingItemLast: { borderBottomWidth: 0 },

    settingText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' },
    logoutText: { color: '#EF4444' },

    // Footer
    accountScrollContent: { flexGrow: 1, paddingBottom: 140 },
    footer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        ...shadows.sm,
    },
    footerBrand: { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },
    footerVersion: { fontSize: 12, color: '#6B7280', marginTop: 4 },
    footerTagline: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    footerCopyright: { fontSize: 11, color: '#6B7280', marginTop: 8, textAlign: 'center' },


    // Filter & Export
    filterExportCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E5E5', marginBottom: 20 },
    filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    filterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 4 },
    filterSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    exportButtons: { flexDirection: 'row', gap: 8 },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#FEE2E2', gap: 4 },
    excelBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#D1FAE5', gap: 4 },
    pdfBtnText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
    excelBtnText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
    dateFiltersRow: { flexDirection: 'row', gap: 12 },
    dateFilterItem: { flex: 1 },
    filterLabel: { fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
    dateInputContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
    dateInput: { fontSize: 13, color: '#374151' },
    typeFilterContainer: { marginTop: 4 },
    typeDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
    typeDropdownText: { fontSize: 13, color: '#111827' },
    customerDetailDropdownOptions: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, marginTop: 4, zIndex: 100, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    customerDetailDropdownOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    customerDetailDropdownOptionActive: { backgroundColor: '#F9FAFB' },
    customerDetailDropdownOptionText: { fontSize: 13, color: '#374151' },
    customerDetailDropdownOptionTextActive: { color: '#2563EB', fontWeight: '600' },

    // Toast notification styles
    toastContainer: { position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 2000, alignItems: 'center' },
    toastContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, gap: 10, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, borderWidth: 1, borderColor: '#E5E7EB' },
    toastIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
    toastText: { fontSize: 14, fontWeight: '500', color: '#1F2937' },

    // Pagination styles
    paginationCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, marginHorizontal: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, borderWidth: 1, borderColor: '#F3F4F6' },
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
    titleWithBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    countBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8,
    },
    countBadgeText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
    },
});

export default CustomerDashboardScreen;

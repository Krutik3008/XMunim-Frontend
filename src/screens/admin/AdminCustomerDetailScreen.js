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
    Animated,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { customerAPI, shopAPI } from '../../api';
import { Skeleton } from '../../components/ui';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { saveFileToDevice } from '../../utils/downloadHelper';

// Shared saveFileToDevice removed - now using utils/downloadHelper.js

// Utility function moved to downloadHelper.js

const AdminCustomerDetailScreen = ({ route, customer: propCustomer, shopId: propShopId, onBack, showToast: propShowToast }) => {

    const navigation = useNavigation();

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
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={{ color: '#fff', marginTop: 10 }}>Loading Customer...</Text>
            </View>
        );
    }

    const [loading, setLoading] = useState(true);
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

    // Filters
    const [dateFrom, setDateFrom] = useState(''); // Stored as YYYY-MM-DD for consistency or Date object? Let's keep string to match TextInput display if needed, but better to use Date obj.
    // Actually, user wants "DD-MM-YYYY" display but picker returns Date. 
    // Let's store as Date objects or formatted strings.
    // Dashboard usage: const [fromDate, setFromDate] = useState(null); so Date object.
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    // Kept text state for backward compat or just use the derived string? 
    // Let's use derived string for display and Date object for logic.

    const [transactionType, setTransactionType] = useState('all');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);

    // Toast notification bridge
    const showToast = (message, type = 'success') => {
        if (propShowToast) {
            propShowToast(message, type);
        } else {
            // Fallback to alert if no toast prop available (safety)
            Alert.alert(type === 'error' ? 'Error' : 'Notification', message);
        }
    };

    // ... (rest of render) ...




    useEffect(() => {
        loadData();
    }, [customer?.id, shopId]);

    useEffect(() => {
        applyFilters();
    }, [transactions, fromDate, toDate, transactionType]); // Changed dependencies to Date objects

    const loadData = async () => {
        setLoading(true);
        try {
            const txRes = await customerAPI.getTransactions(shopId, customer.id);
            const sortedTx = (txRes.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
            setTransactions(sortedTx);

            const shopRes = await shopAPI.getDashboard(shopId);
            setShopDetails(shopRes.data?.shop);
        } catch (error) {
            showToast("Failed to load customer details", "error");
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...transactions];

        if (fromDate) {
            const startStr = fromDate.toISOString().split('T')[0]; // YYYY-MM-DD
            // Filter logic: t.date >= startStr (at 00:00:00)
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
        // DD-MM-YYYY
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const exportToPDF = async () => {
        try {
            const now = new Date();
            const generatedDate = `${now.toLocaleDateString('en-GB')} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

            const balanceStatus = stats.netBalance > 0 ? 'Has Credit' : (stats.netBalance < 0 ? 'Owes' : 'No Credit');

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
                .header h1 span { color: #D97706; margin-right: 6px; }
                .badge { display: inline-block; background: #DC2626; color: #fff; font-size: 9px; padding: 3px 10px; border-radius: 4px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 4px; }
                .generated { color: #6B7280; font-size: 11px; margin-top: 4px; }
                .section { background: #F9FAFB; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
                .section-title { font-size: 14px; font-weight: bold; color: #111827; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
                .section-title span { color: #D97706; }
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
                    <h1><span>🔒</span> Admin Customer Transaction Report</h1>
                    <div class="generated">${fromDate || toDate ? `Period: ${fromDate ? formatDateDisplay(fromDate) : 'Beginning'} to ${toDate ? formatDateDisplay(toDate) : 'Today'}` : 'Period: Full History'}</div>
                    <div class="badge">ADMIN REPORT</div>
                    <div class="generated">Generated on: ${generatedDate}</div>
                </div>

                <div class="section">
                    <div class="section-title"><span>🏪</span> Shop Information</div>
                    <div class="info-row"><b>Shop Name:</b> ${shopDetails?.name || 'N/A'}</div>
                    <div class="info-row"><b>Location:</b> ${shopDetails?.location || 'N/A'}</div>
                </div>

                <div class="section">
                    <div class="section-title"><span>👤</span> Customer Information</div>
                    <div class="info-row"><b>Name:</b> ${customer.name}</div>
                    <div class="info-row"><b>Phone:</b> +91 ${customer.phone}</div>
                    <div class="info-row"><b>Current Balance:</b> \u20b9${Math.abs(stats.netBalance).toFixed(2)}</div>
                    <div class="info-row"><b>Status:</b> ${balanceStatus}</div>
                </div>

                <div class="analytics">
                    <div class="analytics-box">
                        <div class="label">Total Transactions</div>
                        <div class="value blue">${stats.totalTransactions}</div>
                    </div>
                    <div class="analytics-box">
                        <div class="label">Credits Given</div>
                        <div class="value red">${stats.totalCredits}</div>
                        <div class="sub">\u20b9${stats.totalCreditsAmount.toFixed(2)}</div>
                    </div>
                    <div class="analytics-box">
                        <div class="label">Payments Received</div>
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

                <div class="footer">This is an administrative report generated by ShopMunim Admin Panel</div>
            </body></html>`;

            const { uri } = await Print.printToFileAsync({ html });
            const pdfName = `${customer.name}.pdf`;
            const newUri = FileSystem.cacheDirectory + pdfName;
            await FileSystem.moveAsync({ from: uri, to: newUri });

            if (Platform.OS === 'android') {
                const base64Content = await FileSystem.readAsStringAsync(newUri, { encoding: 'base64' });
                const result = await saveFileToDevice(pdfName, base64Content, 'application/pdf');
                if (result.success) {
                    showToast('Download Successful');
                }
            } else {
                // iOS: save via helper
                const base64Content = await FileSystem.readAsStringAsync(newUri, { encoding: 'base64' });
                const result = await saveFileToDevice(pdfName, base64Content, 'application/pdf');
                if (result.success) {
                    showToast('Download Successful');
                }
            }
        } catch (error) {
            showToast('Failed to generate PDF. Please try again.', 'error');
        }
    };

    const exportToExcel = async () => {
        try {
            const now = new Date();
            const reportDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

            // Build rows as array-of-arrays for precise layout
            const rows = [];
            rows.push(['Customer Transaction Report']);
            rows.push([`Shop: ${shopDetails?.name || 'N/A'}`]);
            rows.push([`Location: ${shopDetails?.location || 'N/A'}`]);
            rows.push([]);
            rows.push([`Customer: ${customer.name} (${customer.phone || 'N/A'})`]);
            rows.push([`Report Generated: ${reportDate}`]);
            rows.push([`Period: ${fromDate || toDate ? `${fromDate ? formatDateDisplay(fromDate) : 'Beginning'} to ${toDate ? formatDateDisplay(toDate) : 'Today'}` : 'Full History'}`]);
            rows.push([]); // Empty row
            rows.push(['Date', 'Type', 'Items', 'Quantity', 'Amount', 'Note']); // Headers

            filteredTransactions.forEach(t => {
                const isPay = t.type === 'debit' || t.type === 'payment' || t.type === 'CREDIT';
                const items = t.products || t.items || [];
                const itemNames = items.map(i => i.name || 'Item').join(', ') || '';
                const totalQty = items.length > 0 ? items.reduce((s, i) => s + (i.quantity || 1), 0) : '';
                rows.push([
                    `${formatShortDate(t.date)} ${formatTime(t.date)}`,
                    isPay ? 'Payment Received' : 'Credit Given',
                    itemNames,
                    totalQty,
                    parseFloat(t.amount || 0),
                    t.note || t.notes || ''
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(rows);

            // Set column widths
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

            const fileName = `${customer.name}.xlsx`;
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
            showToast('Failed to generate Excel file. Please try again.', 'error');
        }
    };

    return (
        <LinearGradient
            colors={['#4c1d95', '#1e40af']} // Deep purple to blue gradient
            style={styles.container}
        >
            <SafeAreaView>
                <TouchableWithoutFeedback onPress={() => { setShowTypeDropdown(false); setShowPerPageDropdown(false); Keyboard.dismiss(); }}>
                    <ScrollView
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 }]}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={() => {
                            setShowTypeDropdown(false);
                            setShowPerPageDropdown(false);
                            Keyboard.dismiss();
                        }}
                    >
                        <View style={styles.headerContent}>
                            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>
                            <View>
                                <Text style={styles.headerTitle}>{customer.name}'s Purchase History</Text>
                            </View>
                        </View>
                        {loading ? (
                            <View style={{ padding: 16 }}>
                                {/* Shop Info Skeleton */}
                                <View style={[styles.card, { padding: 16 }]}>
                                    <Skeleton width="40%" height={20} style={{ marginBottom: 16 }} />
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <Skeleton width="30%" height={14} />
                                            <Skeleton width="50%" height={14} />
                                        </View>
                                    ))}
                                </View>
                                {/* Stats Skeleton */}
                                <View style={styles.sectionCard}>
                                    <Skeleton width="40%" height={20} style={{ marginBottom: 16 }} />
                                    <View style={styles.statsGrid}>
                                        {[1, 2, 3, 4].map(i => (
                                            <View key={i} style={[styles.statBox, { backgroundColor: '#F3F4F6' }]}>
                                                <Skeleton width="60%" height={24} style={{ marginBottom: 8 }} />
                                                <Skeleton width="80%" height={12} />
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>
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
                                    <View style={styles.infoRow}>
                                        <Text style={styles.label}>Owner:</Text>
                                        <Text style={styles.value}>User ({shopDetails?.owner_id || '...'})</Text>
                                    </View>
                                </View>

                                {/* Customer Information Card */}
                                <View style={styles.card}>
                                    <View style={styles.cardHeaderRow}>
                                        <Ionicons name="person-outline" size={20} color="#111827" />
                                        <Text style={styles.cardTitle}>Customer Information</Text>
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

                                {/* Purchase Analytics Section - Owner View Match */}
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

                                {/* Detailed Transaction History */}
                                {(() => {
                                    const totalItems = filteredTransactions.length;
                                    const totalPages = Math.ceil(totalItems / perPage);
                                    const startIdx = (currentPage - 1) * perPage;
                                    const endIdx = Math.min(startIdx + perPage, totalItems);
                                    const paginatedTx = filteredTransactions.slice(startIdx, endIdx);

                                    return (
                                        <>
                                            <View style={[styles.sectionCard, { zIndex: 1 }]}>
                                                <Text style={styles.historyTitle}>Detailed Transaction History</Text>
                                                <Text style={styles.historyCount}>Showing {filteredTransactions.length} transactions</Text>

                                                {filteredTransactions.length === 0 ? (
                                                    <View style={styles.emptyState}>
                                                        <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                                                        <Text style={styles.emptyText}>No transactions found</Text>
                                                    </View>
                                                ) : (
                                                    paginatedTx.map((transaction) => {
                                                        const isPayment = transaction.type === 'debit' || transaction.type === 'payment' || transaction.type === 'CREDIT';
                                                        const isPaymentItem = transaction.type === 'debit' || transaction.type === 'payment' || transaction.type === 'CREDIT';
                                                        const items = transaction.products || transaction.items || [];

                                                        return (
                                                            <View key={transaction.id} style={styles.transactionCard}>
                                                                <View style={styles.txHeader}>
                                                                    <View style={[styles.txBadge, { backgroundColor: isPaymentItem ? '#000' : '#EF4444' }]}>
                                                                        <Text style={styles.txBadgeText}>{isPaymentItem ? 'Payment Received' : 'Purchase (Credit)'}</Text>
                                                                    </View>
                                                                    <View style={styles.txAmountSection}>
                                                                        <Text style={[styles.txAmount, { color: isPaymentItem ? '#10B981' : '#EF4444' }]}>
                                                                            {`${isPaymentItem ? '+' : '-'}\u20b9${parseFloat(transaction.amount || 0).toFixed(2)}`}
                                                                        </Text>
                                                                        <Text style={styles.txAmountLabel}>Amount {isPaymentItem ? 'paid' : 'Dues'}</Text>
                                                                    </View>
                                                                </View>

                                                                <View style={styles.txDateRow}>
                                                                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                                                                    <Text style={styles.txDate}>{formatShortDate(transaction.date)}</Text>
                                                                </View>

                                                                {isPaymentItem && (
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

                                            {/* Pagination Card - Outside transaction card */}
                                            {totalItems > 0 && (
                                                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, marginBottom: -10, marginHorizontal: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, borderWidth: 1, borderColor: '#F3F4F6', zIndex: 20, overflow: 'visible' }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, zIndex: 10, overflow: 'visible' }}>
                                                        <Text style={{ fontSize: 13, color: '#6B7280' }}>
                                                            Showing {startIdx + 1} to {endIdx} of <Text style={{ fontWeight: '700' }}>{totalItems} transactions</Text>
                                                        </Text>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, position: 'relative', zIndex: 10, overflow: 'visible' }}>
                                                            <Text style={{ fontSize: 13, color: '#6B7280' }}>Show:</Text>
                                                            <TouchableOpacity
                                                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, gap: 4 }}
                                                                onPress={() => setShowPerPageDropdown(!showPerPageDropdown)}
                                                            >
                                                                <Text style={{ fontSize: 13, color: '#111827', fontWeight: '500' }}>{perPage}</Text>
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
                                })()}

                                <View style={{ height: 20 }} />
                            </>
                        )}
                    </ScrollView>
                </TouchableWithoutFeedback>


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

            {/* Removed internal toast UI as it's now handled by AdminPanelScreen */}

        </LinearGradient>
    );
};

const SafeAreaView = ({ children }) => (
    <View style={{ flex: 1 }}>{children}</View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, paddingVertical: 12, marginBottom: 24 },
    backButton: { marginRight: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', letterSpacing: 0.5 },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

    scrollContent: { padding: 16, paddingBottom: 10 },

    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },

    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    label: { fontSize: 14, color: '#111827', width: 80, fontWeight: 'bold' },
    value: { fontSize: 14, color: '#111827', flex: 1 },

    codeBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    codeText: { fontSize: 12, fontWeight: 'bold', color: '#374151' },

    customerNameMain: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    customerPhone: { fontSize: 14, color: '#6B7280', marginBottom: 20 },

    historySection: { marginBottom: 20 },
    historyTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    historyCount: { fontSize: 13, color: '#6B7280', marginBottom: 16 },

    balanceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    balanceLabel: { fontSize: 14, color: '#111827', marginTop: 4 },
    balanceRight: { alignItems: 'flex-end' },
    balanceAmount: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    textRed: { color: '#DC2626' },
    textGreen: { color: '#059669' },

    creditBadge: { backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
    creditText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    analyticsGrid: { gap: 12, marginBottom: 16 },
    analyticsGridRow: { flexDirection: 'row', gap: 12 },
    analyticsItem: { flex: 1, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
    analyticsValue: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
    analyticsSubValue: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    analyticsLabel: { fontSize: 12, color: '#4B5563', textAlign: 'center' },

    netBalanceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12 },
    netBalanceLabel: { fontSize: 14, color: '#374151', paddingVertical: 1 },
    netBalanceValue: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
    netBalanceStatus: { fontSize: 14, fontWeight: 'bold' },

    listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 10 },
    sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    filterBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: '#E5E7EB' },
    filterText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },

    txCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, padding: 14 },
    txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    txTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    txTypeText: { color: '#111827', fontWeight: 'bold', fontSize: 14 },
    txHeaderAmount: { fontWeight: 'bold', fontSize: 16 },

    txBody: {},
    txDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    txDateText: { fontSize: 12, color: '#9CA3AF' },

    itemsContainer: { backgroundColor: '#F9FAFB', padding: 8, borderRadius: 6, marginTop: 8 },
    itemsLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#4B5563' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
    itemName: { fontSize: 12, color: '#374151', flex: 1 },
    itemTotal: { fontSize: 12, fontWeight: '600', color: '#111827' },

    noteContainer: { marginTop: 6 },
    noteText: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },

    clearDateBtn: { padding: 4 },

    sectionDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 16,
    },

    // New Styles from admin Screen
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
    toastContainer: { position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 999, alignItems: 'center' },
    toastContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, gap: 10, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, borderWidth: 1, borderColor: '#E5E7EB' },
    toastIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
    toastText: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
});

export default AdminCustomerDetailScreen;

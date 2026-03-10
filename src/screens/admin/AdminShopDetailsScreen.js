import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    BackHandler,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { customerAPI, getAPIErrorMessage } from '../../api';
import AdminCustomerDetailScreen from './AdminCustomerDetailScreen';
import { Skeleton } from '../../components/ui';

const AdminShopDetailsScreen = ({ shopId, shopName, shopCategory, shopCode, onBack, showToast }) => {

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [stats, setStats] = useState({
        totalCustomers: 0,
        periodActiveCustomers: 0,
        withDues: 0,
        totalTransactions: 0,
        totalAmount: 0,
        totalSales: 0,
        totalPayments: 0,
        totalDues: 0
    });

    // Date Filters
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);


    useEffect(() => {
        if (shopId) {
            fetchData();
        } else {
            if (showToast) {
                showToast('No shop ID provided', 'error');
            } else {
                Alert.alert('Error', 'No shop ID provided');
            }
            onBack();
        }
    }, [shopId]);

    // Android hardware back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (selectedCustomer) {
                setSelectedCustomer(null);
                return true;
            }
            if (onBack) {
                onBack();
                return true;
            }
            return false;
        });
        return () => backHandler.remove();
    }, [selectedCustomer, onBack]);

    // Re-fetch when date filters change
    useEffect(() => {
        if (shopId) {
            fetchData();
        }
    }, [fromDate, toDate]);

    const formatDateDisplay = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    };

    const formatDateForAPI = (date, isEndOfDay = false) => {
        if (!date) return null;
        const d = new Date(date);
        if (isEndOfDay) {
            d.setHours(23, 59, 59, 999);
        } else {
            d.setHours(0, 0, 0, 0);
        }
        return d.toISOString();
    };

    const onFromDateChange = (event, selectedDate) => {
        setShowFromPicker(false);
        if (event.type === 'dismissed') {
            setFromDate(null);
            return;
        }
        if (selectedDate) {
            setFromDate(selectedDate);
        }
    };

    const onToDateChange = (event, selectedDate) => {
        setShowToPicker(false);
        if (event.type === 'dismissed') {
            setToDate(null);
            return;
        }
        if (selectedDate) {
            setToDate(selectedDate);
        }
    };

    const clearDateFilters = () => {
        setFromDate(null);
        setToDate(null);
    };


    const fetchData = async () => {
        try {
            setLoading(true);
            const params = {};
            if (fromDate) params.from_date = formatDateForAPI(fromDate, false);
            if (toDate) params.to_date = formatDateForAPI(toDate, true);
            const response = await customerAPI.getAll(shopId, params);
            const responseData = response.data || {};
            const fetchedCustomers = responseData.customers || responseData || [];

            const enrichedCustomers = (Array.isArray(fetchedCustomers) ? fetchedCustomers : []).map(c => ({
                ...c,
                totalTransactions: c.total_transactions || 0,
                lastTransaction: c.last_transaction_date,
                periodDelta: c.period_delta || 0,
                shop: { id: shopId, name: shopName, category: shopCategory }
            }));

            setCustomers(enrichedCustomers);

            const duesCount = responseData.with_dues != null
                ? responseData.with_dues
                : enrichedCustomers.filter(c => (c.balance || 0) < 0).length;

            setStats({
                totalCustomers: responseData.total_customers || enrichedCustomers.length,
                periodActiveCustomers: responseData.period_active_customers || 0,
                withDues: responseData.all_time_with_dues || responseData.with_dues || 0,
                totalTransactions: responseData.period_transactions || responseData.total_transactions || 0,
                totalAmount: responseData.total_amount || 0,
                totalSales: responseData.period_sales || responseData.total_sales || 0,
                totalPayments: responseData.period_payments || responseData.total_payments || 0,
                totalDues: responseData.all_time_total_dues || responseData.total_dues || 0
            });

        } catch (err) {
            if (showToast) {
                showToast(getAPIErrorMessage(err), 'error');
            } else {
                Alert.alert('Error', getAPIErrorMessage(err));
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterCustomers = () => {
        let filtered = [...customers];
        if (search.trim()) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(c =>
                c.name?.toLowerCase().includes(searchLower) ||
                c.phone?.includes(search)
            );
        }
        return filtered;
    };

    const filteredCustomers = filterCustomers();
    const totalItems = filteredCustomers.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const startIdx = (currentPage - 1) * perPage;
    const endIdx = Math.min(startIdx + perPage, totalItems);
    const paginatedCustomers = filteredCustomers.slice(startIdx, endIdx);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short'
        });
    };

    // Inline Detail View
    if (selectedCustomer) {
        return (
            <AdminCustomerDetailScreen
                customer={selectedCustomer}
                shopId={shopId}
                onBack={() => setSelectedCustomer(null)}
                showToast={showToast}
            />
        );
    }

    const renderCustomerItem = ({ item }) => {
        const balance = item.balance || 0;
        const isCredit = balance > 0;
        const isClear = balance === 0;
        const isOwes = balance < 0;

        return (
            <View style={styles.customerCard}>

                {/* Header: Name and Balance Pill */}
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.customerName}>{item.name}</Text>
                        {(fromDate || toDate) && (
                            <Text style={[styles.periodDeltaText, { color: item.periodDelta < 0 ? '#EF4444' : item.periodDelta > 0 ? '#10B981' : '#6B7280' }]}>
                                {item.periodDelta < 0 ? `Added ₹${Math.abs(item.periodDelta).toFixed(0)} Dues` :
                                    item.periodDelta > 0 ? `Paid ₹${item.periodDelta.toFixed(0)}` :
                                        'No change in period'}
                            </Text>
                        )}
                    </View>
                    <View style={styles.balanceContainer}>
                        <View style={[
                            styles.balancePill,
                            isCredit ? styles.pillCredit : isOwes ? styles.pillDue : styles.pillClear
                        ]}>
                            <Text style={[
                                styles.balanceText,
                                isCredit ? styles.textCredit : isOwes ? styles.textDue : styles.textClear
                            ]}>
                                {isCredit ? '+' : isOwes ? '-' : ''}₹{Math.abs(balance).toFixed(0)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Sub-Header: Phone, Shop, Credit Badge */}
                <View style={styles.cardSubHeader}>
                    <View>
                        <View style={styles.infoRow}>
                            <Ionicons name="call-outline" size={14} color="#6B7280" />
                            <Text style={styles.infoText}>  {item.phone}</Text>
                        </View>
                        {item.shop && (
                            <View style={[styles.infoRow, { marginTop: 4 }]}>
                                <Ionicons name="storefront-outline" size={14} color="#6B7280" />
                                <Text style={styles.infoText}>  {item.shop.name}</Text>
                            </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <View style={[
                                styles.creditBadge,
                                isCredit ? styles.badgeCredit : isOwes ? styles.badgeDue : styles.badgeClear,
                                { marginRight: 8 }
                            ]}>
                                <Text style={styles.creditBadgeText}>
                                    {isCredit ? 'Credit' : isOwes ? 'Dues' : 'Clear'}
                                </Text>
                            </View>
                            <Text
                                style={[{
                                    fontSize: 15,
                                    fontWeight: '700',
                                    color: isCredit ? '#10B981' : isOwes ? '#EF4444' : '#6B7280',
                                }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit={true}
                                minimumFontScale={0.5}
                            >
                                {isCredit ? '+' : isOwes ? '-' : ''}₹{Math.abs(balance).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Details Section */}
                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Category:</Text>
                        <Text style={styles.detailValue}>{item.shop?.category || shopCategory || 'General'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Transactions:</Text>
                        <Text style={styles.detailValue}>{item.totalTransactions || 0}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Last Purchase:</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="calendar-outline" size={14} color="#111827" style={{ marginRight: 4 }} />
                            <Text style={styles.detailValue}>{formatDate(item.lastTransaction)}</Text>
                        </View>
                    </View>
                </View>

                {/* View Details Button */}
                <TouchableOpacity
                    style={styles.viewDetailsBtn}
                    onPress={() => {
                        setSelectedCustomer(item);
                    }}
                >
                    <Ionicons name="eye-outline" size={16} color="#111827" style={{ marginRight: 6 }} />
                    <Text style={styles.viewDetailsText}>View Details</Text>
                </TouchableOpacity>

            </View>
        );
    };

    const StatsCard = ({ icon, title, value, subtitle, color, iconBg }) => (
        <View style={styles.statCard}>
            <View style={styles.statCardTop}>
                <Text style={styles.statLabel}>{title}</Text>
                <View style={[styles.statIconContainer, { backgroundColor: iconBg || '#F3F4F6' }]}>
                    <Ionicons name={icon} size={18} color={color} />
                </View>
            </View>
            {loading && !refreshing ? (
                <>
                    <Skeleton width="60%" height={26} style={{ marginBottom: 4 }} />
                    <Skeleton width="40%" height={12} />
                </>
            ) : (
                <>
                    <Text
                        style={styles.statValue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                    >
                        {value}
                    </Text>
                    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
                </>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#4c1d95', '#2563EB']}
                style={styles.gradient}
            >
                <TouchableWithoutFeedback onPress={() => { setShowPerPageDropdown(false); Keyboard.dismiss(); }}>
                    <ScrollView
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 }]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={() => {
                            setShowPerPageDropdown(false);
                            Keyboard.dismiss();
                        }}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onBack} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.headerTitle} numberOfLines={1}>{shopName || 'Shop Details'}'s Business Customers</Text>
                            </View>
                        </View>

                        {/* Stats Grid 2x2 */}
                        <View style={styles.statsContainer}>
                            <View style={styles.statsRow}>
                                <StatsCard
                                    icon="people-outline"
                                    title="Customers"
                                    value={(fromDate || toDate) ? stats.periodActiveCustomers : stats.totalCustomers}
                                    subtitle={(fromDate || toDate) ? 'Active This Period' : 'Total Registered'}
                                    color="#2563EB"
                                    iconBg="#EFF6FF"
                                />
                                <StatsCard
                                    icon="swap-horizontal-outline"
                                    title="Transactions"
                                    value={stats.totalTransactions}
                                    subtitle={(fromDate || toDate) ? 'Filtered' : 'All time'}
                                    color="#7C3AED"
                                    iconBg="#F3E8FF"
                                />
                            </View>
                            <View style={styles.statsRow}>
                                <StatsCard
                                    icon="wallet-outline"
                                    title="₹ Amount"
                                    value={`₹${(stats.totalSales || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`}
                                    subtitle={(fromDate || toDate) ? 'Sales (Filtered)' : 'Total Sales'}
                                    color="#059669"
                                    iconBg="#D1FAE5"
                                />
                                <StatsCard
                                    icon="trending-down-outline"
                                    title="With Dues"
                                    value={stats.withDues}
                                    subtitle={`₹${(stats.totalDues || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} Total Dues`}
                                    color="#DC2626"
                                    iconBg="#FEE2E2"
                                />
                            </View>
                        </View>

                        {/* Date Range Filter */}
                        <View style={styles.filterCard}>
                            <View style={styles.filterHeader}>
                                <View style={styles.filterTitleRow}>
                                    <Ionicons name="filter-outline" size={18} color="#374151" />
                                    <Text style={styles.filterTitle}>Filter by Date</Text>
                                </View>
                                {(fromDate || toDate) && (
                                    <TouchableOpacity onPress={clearDateFilters} style={styles.clearBtn}>
                                        <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                                        <Text style={styles.clearBtnText}>Clear</Text>
                                    </TouchableOpacity>
                                )}
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

                            {(fromDate || toDate) && (
                                <View style={styles.activeFilterInfo}>
                                    <Ionicons name="information-circle-outline" size={14} color="#2563EB" />
                                    <Text style={styles.activeFilterText}>
                                        Showing transactions {fromDate ? `from ${formatDateDisplay(fromDate)}` : ''}{fromDate && toDate ? ' ' : ''}{toDate ? `to ${formatDateDisplay(toDate)}` : ''}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Bottom Content Area */}
                        <View style={styles.bottomSheet}>

                            {/* Search Card */}
                            <View style={[styles.searchCard, { zIndex: 10 }]}>
                                <View style={styles.searchHeader}>
                                    <Ionicons name="people-outline" size={20} color="#111827" />
                                    <Text style={styles.searchTitle}>Search Customers</Text>
                                </View>

                                <View style={styles.searchContainerRelative}>
                                    <View style={styles.searchInputContainer}>
                                        <Ionicons name="search-outline" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
                                        <TextInput
                                            style={styles.searchInput}
                                            placeholder="Search customers..."
                                            placeholderTextColor="#9CA3AF"
                                            value={search}
                                            onChangeText={setSearch}
                                        />
                                        {search.length > 0 && (
                                            <TouchableOpacity onPress={() => { setSearch(''); }}>
                                                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                </View>

                                <View style={styles.resultsRow}>
                                    <Text style={styles.resultsText}>
                                        Showing {paginatedCustomers.length} of {filteredCustomers.length} customers
                                    </Text>
                                    <TouchableOpacity onPress={() => { setLoading(true); fetchData(); }} style={styles.refreshBtn}>
                                        <Text style={styles.refreshText}>Refresh Data</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>


                            {/* List */}
                            {loading && !refreshing ? (
                                <View style={styles.listContainer}>
                                    {[1, 2, 3].map(i => (
                                        <View key={i} style={[styles.customerCard, { padding: 16 }]}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                                <Skeleton width="50%" height={20} />
                                                <Skeleton width="25%" height={24} borderRadius={12} />
                                            </View>
                                            <Skeleton width="40%" height={14} style={{ marginBottom: 8 }} />
                                            <Skeleton width="30%" height={16} style={{ marginBottom: 12 }} />
                                            <View style={{ gap: 8 }}>
                                                <Skeleton width="40%" height={14} />
                                                <Skeleton width="30%" height={14} />
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.listContainer}>
                                    {paginatedCustomers.map((item, index) => (
                                        <View key={`${item.id}-${index}`}>
                                            {renderCustomerItem({ item })}
                                        </View>
                                    ))}
                                    {paginatedCustomers.length === 0 && (
                                        <Text style={styles.emptyText}>No customers found.</Text>
                                    )}
                                </View>
                            )}

                            {/* Pagination Card */}
                            {totalItems > 0 && (
                                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: -5, marginBottom: 16, marginHorizontal: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, borderWidth: 1, borderColor: '#F3F4F6', zIndex: 20, overflow: 'visible' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, zIndex: 10, overflow: 'visible' }}>
                                        <Text style={{ fontSize: 13, color: '#6B7280' }}>
                                            Showing {startIdx + 1} to {endIdx} of <Text style={{ fontWeight: '700' }}>{totalItems} customers</Text>
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

                            <View />
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>

                {
                    showFromPicker && (
                        <DateTimePicker
                            value={fromDate || new Date()}
                            mode="date"
                            display="default"
                            onChange={onFromDateChange}
                            positiveButton={{ label: 'Set', textColor: '#2563EB' }}
                            negativeButton={{ label: 'Clear', textColor: '#EF4444' }}
                        />
                    )
                }
                {
                    showToPicker && (
                        <DateTimePicker
                            value={toDate || new Date()}
                            mode="date"
                            display="default"
                            onChange={onToDateChange}
                            positiveButton={{ label: 'Set', textColor: '#2563EB' }}
                            negativeButton={{ label: 'Clear', textColor: '#EF4444' }}
                        />
                    )
                }
            </LinearGradient >
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    filterCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
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
        gap: 6,
    },
    filterTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#FEF2F2',
    },
    clearBtnText: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '600',
    },
    dateFiltersRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dateFilterItem: {
        flex: 1,
    },
    filterLabel: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dateInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: '#F9FAFB',
    },
    dateInput: {
        fontSize: 13,
        color: '#111827',
        fontWeight: '500',
    },
    activeFilterInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
    },
    activeFilterText: {
        fontSize: 11,
        color: '#2563EB',
        fontWeight: '500',
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: 10,
    },
    backButton: {
        marginTop: 15,
        marginRight: 16,
        marginBottom: 10,
    },
    headerTitle: {
        marginTop: 15,
        fontSize: 23,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#E0E7FF',
        marginTop: 4,
    },
    statsContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statLabel: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    statValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
    },
    statSubtitle: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 2,
    },
    bottomSheet: {
        flex: 1,
        paddingHorizontal: 16,
    },
    searchCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    searchTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        marginLeft: 8,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    resultsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    resultsText: {
        fontSize: 14,
        color: '#6B7280',
    },
    refreshBtn: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    refreshText: {
        fontSize: 12,
        color: '#4B5563',
        fontWeight: '500',
    },
    listContainer: {
        paddingBottom: 20,
    },
    customerCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    periodDeltaText: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    customerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    balancePill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    pillCredit: {
        backgroundColor: '#ECFDF5',
    },
    pillDue: {
        backgroundColor: '#FEF2F2',
    },
    pillClear: {
        backgroundColor: '#000000',
    },
    balanceText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    textCredit: {
        color: '#10B981',
    },
    textDue: {
        color: '#EF4444',
    },
    textClear: {
        color: '#FFFFFF',
    },
    cardSubHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 13,
        color: '#6B7280',
    },
    creditBadge: {
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    badgeCredit: {
        backgroundColor: '#10B981',
    },
    badgeDue: {
        backgroundColor: '#EF4444',
    },
    badgeClear: {
        backgroundColor: '#000000',
    },
    creditBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    detailsContainer: {
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 13,
        fontWeight: '500',
        color: '#111827',
    },
    viewDetailsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    viewDetailsText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    emptyText: {
        textAlign: 'center',
        color: '#9CA3AF',
        marginTop: 20,
    },
    paginationRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
    },
    pageBtn: {
        fontSize: 15,
        color: '#4F46E5',
        fontWeight: '600',
    },
    disabledText: {
        color: '#9CA3AF',
    },
    pageText: {
        fontSize: 14,
        color: '#6B7280',
    },
    // Search Suggestions Styling
    searchContainerRelative: {
        position: 'relative',
        zIndex: 20,
    },
    suggestionsDropdown: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 8,
        elevation: 10,
        zIndex: 50,
        maxHeight: 250,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    suggestionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    suggestionName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    suggestionPhone: {
        fontSize: 12,
        color: '#6B7280',
    },
});

export default AdminShopDetailsScreen;

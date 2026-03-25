import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    Modal,
    BackHandler,
    RefreshControl,
    TouchableWithoutFeedback,
    Keyboard,
    Dimensions,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { adminAPI, customerAPI, getAPIErrorMessage } from '../../api';
import { Skeleton } from '../../components/ui';

const { width } = Dimensions.get('window');

const AdminCustomerManagement = ({ showToast }) => {
    const navigation = useNavigation();
    const [customers, setCustomers] = useState([]);
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedShop, setSelectedShop] = useState('all');
    const [selectedType, setSelectedType] = useState('all'); // all, customer, staff, service
    const [stats, setStats] = useState({
        totalCustomers: 0,
        activeShops: 0,
        withDues: 0,
        totalTransactions: 0
    });

    // Pagination for list
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [showPageSizeDropdown, setShowPageSizeDropdown] = useState(false);
    const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30];

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setCurrentPage(0);
        setShowPageSizeDropdown(false);
    };

    // Filter State
    const [showShopDropdown, setShowShopDropdown] = useState(false);
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [shopSearch, setShopSearch] = useState('');

    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            (e) => setKeyboardHeight(e.endCoordinates.height)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardHeight(0)
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    useEffect(() => {
        fetchData();
    }, []);


    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch all shops
            const shopsResponse = await adminAPI.getShops('', 0, 1000);
            const shopsData = shopsResponse.data.shops || [];
            setShops(shopsData);

            // 2. Fetch ALL members directly (to include customers, staff, services)
            const customersResponse = await adminAPI.getCustomers(search, 0, 1000, selectedType);
            const fetchedCustomers = customersResponse.data.customers || [];
            const globalTotalTransactions = customersResponse.data.total_global_transactions || 0;

            // 3. Map to internal format
            const enrichedCustomers = fetchedCustomers.map(c => ({
                ...c,
                totalTransactions: c.total_transactions || 0,
                lastTransaction: c.last_transaction_date,
                // Ensure shop object is present
                shop: c.shop || shopsData.find(s => s.id === c.shop_id) || { name: 'Unknown', category: 'General' }
            }));

            setCustomers(enrichedCustomers);

            // 4. Update Stats
            const totalTxCount = globalTotalTransactions > 0 ? globalTotalTransactions : enrichedCustomers.reduce((sum, c) => sum + (c.totalTransactions || 0), 0);

            setStats({
                totalCustomers: enrichedCustomers.length,
                activeShops: shopsData.length,
                withDues: enrichedCustomers.filter(c => c.balance < 0).length,
                totalTransactions: totalTxCount
            });

        } catch (err) {
            if (showToast) {
                if (err.response && err.response.status === 404) {
                    showToast('Server Update Required: The /admin/customers endpoint was not found.', 'error');
                } else {
                    showToast(getAPIErrorMessage(err), 'error');
                }
            } else {
                if (err.response && err.response.status === 404) {
                    Alert.alert('Server Update Required', 'The /admin/customers endpoint was not found. Please RESTART your backend server terminal to apply the latest changes.');
                } else {
                    Alert.alert('Error', getAPIErrorMessage(err));
                }
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Re-fetch when type changes
    useEffect(() => {
        fetchData();
    }, [selectedType]);


    const filterCustomers = () => {
        let filtered = [...customers];

        if (search.trim()) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(c =>
                c.name?.toLowerCase().includes(searchLower) ||
                c.phone?.includes(search) ||
                c.shop?.name?.toLowerCase().includes(searchLower)
            );
        }
        
        // Note: Backend handles member_type filtering, frontend handles shop filtering locally for performance 
        // if we have all data. However, if we change shop, we might need to re-fetch if we use true pagination.
        // For now, these are filtered locally from the 1000 limit.

        if (selectedShop !== 'all') {
            filtered = filtered.filter(c => c.shop?.id === selectedShop);
        }

        return filtered;
    };

    const filteredCustomers = filterCustomers();
    const paginatedCustomers = filteredCustomers.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
    const totalPages = Math.ceil(filteredCustomers.length / pageSize);

    const formatCurrency = (amount) => {
        return `₹${parseFloat(Math.abs(amount || 0)).toFixed(0)}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short'
        });
    };

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
                        <View style={[
                            styles.typeBadge,
                            { backgroundColor: item.member_type === 'staff' ? '#FEE2E2' : item.member_type === 'service' ? '#E0F2FE' : '#F3F4F6' }
                        ]}>
                            <Text style={[
                                styles.typeBadgeText,
                                { color: item.member_type === 'staff' ? '#DC2626' : item.member_type === 'service' ? '#0284C7' : '#6B7280' }
                            ]}>
                                {item.member_type?.toUpperCase() || 'CUSTOMER'}
                            </Text>
                        </View>
                    </View>
                    <View style={[
                        styles.balancePill,
                        { backgroundColor: isCredit ? '#ECFDF5' : isOwes ? '#FEF2F2' : '#F3F4F6' }
                    ]}>
                        <Text style={[
                            styles.balanceText,
                            isCredit ? { color: '#10B981' } : isOwes ? { color: '#EF4444' } : { color: '#374151' } // Green : Red : Gray
                        ]}>
                            ₹{Math.abs(balance).toFixed(0)}
                        </Text>
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
                    </View>
                    <View style={[
                        styles.creditBadge,
                        isCredit ? { backgroundColor: '#000000' } : isOwes ? { backgroundColor: '#EF4444' } : { backgroundColor: '#F3F4F6' }
                    ]}>
                        <Text style={[
                            styles.creditBadgeText,
                            isClear ? { color: '#000000' } : { color: '#FFFFFF' }
                        ]}>
                            {isCredit ? 'Credit' : isOwes ? 'Dues' : 'Clear'}
                        </Text>
                    </View>
                </View>

                {/* Details Section */}
                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Category:</Text>
                        <Text style={styles.detailValue}>{item.shop?.category || 'General'}</Text>
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
                        if (!item.shop?.id) {
                            if (showToast) {
                                showToast('Shop information missing for this customer.', 'error');
                            } else {
                                Alert.alert('Error', 'Shop information missing for this customer.');
                            }
                            return;
                        }
                        if (item.member_type === 'staff') {
                            navigation.navigate('AdminStaffDetail', { customer: item, shopId: item.shop.id });
                        } else if (item.member_type === 'service') {
                            navigation.navigate('AdminServiceDetail', { customer: item, shopId: item.shop.id });
                        } else {
                            navigation.navigate('AdminCustomerDetail', { customer: item, shopId: item.shop.id });
                        }
                    }}
                >
                    <Ionicons name="eye-outline" size={16} color="#111827" style={{ marginRight: 6 }} />
                    <Text style={styles.viewDetailsText}>View Details</Text>
                </TouchableOpacity>

            </View>
        );
    };

    const StatsCard = ({ icon, title, value, subtext, color, iconBg, isLoading }) => (
        <View style={styles.statCard}>
            <View style={styles.statHeader}>
                <Text style={styles.statLabel}>{title}</Text>
                <View style={[styles.statIconContainer, { backgroundColor: iconBg || '#F3F4F6' }]}>
                    <Ionicons name={icon} size={18} color={color || "#6B7280"} />
                </View>
            </View>
            {isLoading ? (
                <Skeleton width="60%" height={28} style={{ marginBottom: 4, marginTop: 2 }} />
            ) : (
                <Text style={styles.statValue}>{value}</Text>
            )}
            {isLoading ? (
                <Skeleton width="40%" height={12} />
            ) : (
                <Text style={styles.statSubtext}>{subtext}</Text>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#fff" />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Customer Analytics</Text>
                    <Text style={styles.headerSubtitle}>View and manage customers across all shops</Text>
                </View>

                {/* Stats Stack */}
                <View style={styles.statsContainer}>
                    <StatsCard
                        icon="people-outline"
                        title="Members"
                        value={stats.totalCustomers}
                        subtext="Total Registered"
                        color="#2563EB"
                        iconBg="#EFF6FF"
                        isLoading={loading}
                    />
                    <StatsCard
                        icon="storefront-outline"
                        title="Active Shops"
                        value={stats.activeShops}
                        subtext="On Platform"
                        color="#059669"
                        iconBg="#D1FAE5"
                        isLoading={loading}
                    />
                    <StatsCard
                        icon="trending-down-outline"
                        title="With Dues"
                        value={stats.withDues}
                        subtext="Pending Payments"
                        color="#DC2626"
                        iconBg="#FEE2E2"
                        isLoading={loading}
                    />
                    <StatsCard
                        icon="swap-horizontal-outline"
                        title="Transactions"
                        value={stats.totalTransactions}
                        subtext="All time"
                        color="#7C3AED"
                        iconBg="#F3E8FF"
                        isLoading={loading}
                    />
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

                        <View style={styles.filterRow}>
                            <TouchableOpacity
                                style={[styles.filterBtn, { flex: 1, marginRight: 8 }]}
                                onPress={() => setShowTypeDropdown(true)}
                            >
                                <View style={styles.filterBtnContent}>
                                    <Ionicons name="person-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
                                    <Text style={styles.filterBtnText} numberOfLines={1}>
                                        {selectedType === 'all' ? 'All Types' : selectedType === 'customer' ? 'Customers' : selectedType === 'staff' ? 'Staff' : 'Services'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-down" size={16} color="#6B7280" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.filterBtn, { flex: 1 }]}
                                onPress={() => setShowShopDropdown(true)}
                            >
                                <View style={styles.filterBtnContent}>
                                    <Ionicons name="storefront-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
                                    <Text style={styles.filterBtnText} numberOfLines={1}>
                                        {selectedShop === 'all' ? 'All Shops' : shops.find(s => s.id === selectedShop)?.name || 'Selected Shop'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-down" size={16} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.resultsRow}>
                            <Text style={styles.resultsText}>
                                Showing {paginatedCustomers.length} of {filteredCustomers.length} members
                            </Text>
                            <TouchableOpacity onPress={() => { setLoading(true); fetchData(); }} style={styles.refreshBtn}>
                                <Text style={styles.refreshText}>Refresh</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>


                {/* List */}
                {loading && !refreshing ? (
                    <View style={styles.listContainer}>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <View key={i} style={[styles.customerCard, { padding: 16 }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <Skeleton width="50%" height={20} />
                                    <Skeleton width="20%" height={24} borderRadius={4} />
                                </View>
                                <View style={{ marginBottom: 12 }}>
                                    <Skeleton width="40%" height={14} style={{ marginBottom: 8 }} />
                                    <Skeleton width="60%" height={14} />
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                                    <Skeleton width="30%" height={36} borderRadius={8} />
                                    <Skeleton width="30%" height={36} borderRadius={8} />
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

                {/* Pagination */}
                {/* Pagination - Advanced */}
                <View style={styles.paginationContainer}>
                    <View style={styles.paginationTopRow}>
                        <Text style={styles.paginationInfoText}>
                            Showing {paginatedCustomers.length === 0 ? 0 : currentPage * pageSize + 1} to{' '}
                            {Math.min((currentPage + 1) * pageSize, filteredCustomers.length)} of{' '}
                            <Text style={styles.paginationInfoBold}>{filteredCustomers.length} members</Text>
                        </Text>

                        <View style={styles.pageSizeSelector}>
                            <Text style={styles.pageSizeLabel}>Show:</Text>
                            <View>
                                <TouchableOpacity
                                    style={styles.pageSizeDropdownButton}
                                    onPress={() => setShowPageSizeDropdown(!showPageSizeDropdown)}
                                >
                                    <Text style={styles.pageSizeDropdownText}>{pageSize}</Text>
                                    <Ionicons name={showPageSizeDropdown ? 'chevron-up' : 'chevron-down'} size={14} color="#374151" />
                                </TouchableOpacity>
                                {showPageSizeDropdown && (
                                    <View style={styles.pageSizeDropdownMenu}>
                                        {PAGE_SIZE_OPTIONS.map((size) => (
                                            <TouchableOpacity
                                                key={size}
                                                style={[styles.pageSizeDropdownItem, pageSize === size && styles.pageSizeDropdownItemActive]}
                                                onPress={() => handlePageSizeChange(size)}
                                            >
                                                <Text style={[styles.pageSizeDropdownItemText, pageSize === size && styles.pageSizeDropdownItemTextActive]}>{size}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    <View style={styles.paginationDivider} />

                    <View style={styles.paginationBottomRow}>
                        <TouchableOpacity
                            style={[styles.pageButton, currentPage === 0 && styles.pageButtonDisabled]}
                            onPress={() => setCurrentPage(c => Math.max(0, c - 1))}
                            disabled={currentPage === 0}
                        >
                            <Ionicons name="chevron-back" size={14} color={currentPage === 0 ? '#D1D5DB' : '#374151'} />
                            <Text style={[styles.pageButtonText, currentPage === 0 && styles.pageButtonTextDisabled]}>Previous</Text>
                        </TouchableOpacity>

                        <View style={styles.pageInfoBox}>
                            <Text style={styles.pageInfoLabel}>Page</Text>
                            <Text style={styles.pageInfoNumber}>{currentPage + 1} of {Math.max(1, totalPages)}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.pageButton, currentPage >= totalPages - 1 && styles.pageButtonDisabled]}
                            onPress={() => setCurrentPage(c => Math.min(totalPages - 1, c + 1))}
                            disabled={currentPage >= totalPages - 1}
                        >
                            <Text style={[styles.pageButtonText, currentPage >= totalPages - 1 && styles.pageButtonTextDisabled]}>Next</Text>
                            <Ionicons name="chevron-forward" size={14} color={currentPage >= totalPages - 1 ? '#D1D5DB' : '#374151'} />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Shop Selection Modal (Bottom Sheet Style) */}
            <Modal
                visible={showShopDropdown}
                transparent={true}
                animationType="slide"
                onRequestClose={() => { Keyboard.dismiss(); setShowShopDropdown(false); }}
            >
                <View style={[
                    styles.modalOverlay,
                    Platform.OS === 'android' ? { paddingBottom: keyboardHeight } : {}
                ]}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => { Keyboard.dismiss(); setShowShopDropdown(false); }}
                    />
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ width: '100%' }}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.modalIconContainer}>
                                        <Ionicons name="storefront-outline" size={20} color="#7C3AED" />
                                    </View>
                                    <View>
                                        <Text style={styles.modalTitle}>Select Shop</Text>
                                        <Text style={styles.modalSubtitle}>Filter customers by shop location</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowShopDropdown(false); }} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalSearchContainer}>
                                <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                                <TextInput
                                    style={styles.modalSearchInput}
                                    placeholder="Search by shop name..."
                                    placeholderTextColor="#9CA3AF"
                                    value={shopSearch}
                                    onChangeText={setShopSearch}
                                    autoCorrect={false}
                                />
                                {shopSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setShopSearch('')}>
                                        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <ScrollView
                                style={styles.modalList}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                                onScrollBeginDrag={Keyboard.dismiss}
                                showsVerticalScrollIndicator={true}
                                nestedScrollEnabled={true}
                            >
                                {shopSearch.length === 0 && (
                                    <TouchableOpacity
                                        style={[styles.modalItem, selectedShop === 'all' && styles.modalItemActive]}
                                        onPress={() => {
                                            setSelectedShop('all');
                                            setShowShopDropdown(false);
                                            setShopSearch('');
                                            Keyboard.dismiss();
                                        }}
                                    >
                                        <View style={[styles.modalItemIcon, selectedShop === 'all' && { backgroundColor: '#F5F3FF' }]}>
                                            <Ionicons name="apps-outline" size={20} color={selectedShop === 'all' ? '#7C3AED' : '#6B7280'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.modalItemText, selectedShop === 'all' && styles.modalItemTextActive]}>All Shops</Text>
                                            <Text style={styles.modalItemSubtext}>View aggregation of all shops</Text>
                                        </View>
                                        {selectedShop === 'all' && <Ionicons name="checkmark-circle" size={22} color="#7C3AED" />}
                                    </TouchableOpacity>
                                )}

                                {shops
                                    .filter(shop =>
                                        shop.name?.toLowerCase().includes(shopSearch.toLowerCase())
                                    )
                                    .map(shop => (
                                        <TouchableOpacity
                                            key={shop.id}
                                            style={[styles.modalItem, selectedShop === shop.id && styles.modalItemActive]}
                                            onPress={() => {
                                                setSelectedShop(shop.id);
                                                setShowShopDropdown(false);
                                                setShopSearch('');
                                                Keyboard.dismiss();
                                            }}
                                        >
                                            <View style={[styles.modalItemIcon, selectedShop === shop.id && { backgroundColor: '#F5F3FF' }]}>
                                                <Ionicons name="storefront-outline" size={20} color={selectedShop === shop.id ? '#7C3AED' : '#6B7280'} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.modalItemText, selectedShop === shop.id && styles.modalItemTextActive]}>{shop.name}</Text>
                                                <Text style={styles.modalItemSubtext}>{shop.location || 'No location set'}</Text>
                                            </View>
                                            {selectedShop === shop.id && <Ionicons name="checkmark-circle" size={22} color="#7C3AED" />}
                                        </TouchableOpacity>
                                    ))}

                                {shops.filter(shop =>
                                    shop.name?.toLowerCase().includes(shopSearch.toLowerCase())
                                ).length === 0 && (
                                        <View style={styles.modalEmptyState}>
                                            <Ionicons name="search-outline" size={48} color="#E5E7EB" />
                                            <Text style={styles.modalEmptyText}>No shops matching "{shopSearch}"</Text>
                                        </View>
                                    )}
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Type Selection Modal */}
            <Modal
                visible={showTypeDropdown}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTypeDropdown(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => setShowTypeDropdown(false)}
                    />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.modalIconContainer}>
                                    <Ionicons name="people-outline" size={20} color="#7C3AED" />
                                </View>
                                <View>
                                    <Text style={styles.modalTitle}>Member Type</Text>
                                    <Text style={styles.modalSubtitle}>Filter results by category</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setShowTypeDropdown(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ paddingVertical: 8 }}>
                            {[
                                { id: 'all', name: 'All Members', icon: 'apps-outline', sub: 'View everyone combined' },
                                { id: 'customer', name: 'Customers', icon: 'person-outline', sub: 'Regular shop customers' },
                                { id: 'staff', name: 'Staff', icon: 'briefcase-outline', sub: 'Salaried or hourly employees' },
                                { id: 'service', name: 'Services', icon: 'construct-outline', sub: 'External service providers' }
                            ].map(type => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[styles.modalItem, selectedType === type.id && styles.modalItemActive]}
                                    onPress={() => {
                                        setSelectedType(type.id);
                                        setShowTypeDropdown(false);
                                    }}
                                >
                                    <View style={[styles.modalItemIcon, selectedType === type.id && { backgroundColor: '#F5F3FF' }]}>
                                        <Ionicons name={type.icon} size={20} color={selectedType === type.id ? '#7C3AED' : '#6B7280'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.modalItemText, selectedType === type.id && styles.modalItemTextActive]}>{type.name}</Text>
                                        <Text style={styles.modalItemSubtext}>{type.sub}</Text>
                                    </View>
                                    {selectedType === type.id && <Ionicons name="checkmark-circle" size={22} color="#7C3AED" />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
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
        paddingBottom: 30,
    },
    header: {
        padding: 16,
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#E5E7EB',
        marginTop: 2,
    },
    statsContainer: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
    },
    statCard: {
        width: (width - 40) / 2, // 2 columns with spacing
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statIconContainer: {
        width: 32, // Slightly smaller icon container
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statTextContainer: {
        justifyContent: 'flex-end',
    },
    statLabel: {
        fontSize: 13, // Slightly smaller
        color: '#4B5563',
        fontWeight: '500',
        flex: 1,
        marginRight: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 2,
    },
    statSubtext: {
        fontSize: 10,
        color: '#9CA3AF',
    },
    bottomSheet: {
        flex: 1,
        // No background here, just container
        paddingHorizontal: 16,
    },
    searchCard: {
        backgroundColor: '#fff',
        borderRadius: 12, // Matches design
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
    filterRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
        backgroundColor: '#fff',
    },
    filterBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    filterBtnText: {
        fontSize: 14,
        color: '#374151',
        flex: 1,
    },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
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
        backgroundColor: '#111827',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    refreshText: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '600',
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    customerCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        // Elevation/Shadow
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
    customerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    balancePill: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    balanceText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#10B981',
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
        backgroundColor: '#111827', // Dark black/gray
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
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
    // Pagination Styles
    paginationContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    paginationInfoText: {
        fontSize: 12,
        color: '#6B7280',
        flexShrink: 1,
    },
    paginationInfoBold: {
        fontWeight: '600',
        color: '#374151',
    },
    paginationDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 12,
    },
    paginationTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paginationBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pageSizeSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pageSizeLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginRight: 4,
    },
    pageSizeDropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 6,
        backgroundColor: '#fff',
        gap: 6,
    },
    pageSizeDropdownText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    pageSizeDropdownMenu: {
        position: 'absolute',
        bottom: 38,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingVertical: 4,
        minWidth: 70,
        zIndex: 100,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    pageSizeDropdownItem: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        alignItems: 'center',
    },
    pageSizeDropdownItemActive: {
        backgroundColor: '#EEF2FF',
    },
    pageSizeDropdownItemText: {
        fontSize: 13,
        color: '#374151',
    },
    pageSizeDropdownItemTextActive: {
        color: '#4F46E5',
        fontWeight: '600',
    },
    pageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#fff',
        gap: 4,
    },
    pageButtonDisabled: {
        backgroundColor: '#F9FAFB',
        borderColor: '#E5E7EB',
    },
    pageButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },
    pageButtonTextDisabled: {
        color: '#9CA3AF',
    },
    pageInfoBox: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    pageInfoLabel: {
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    pageInfoNumber: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        maxHeight: '90%',
        minHeight: 400,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16, // Reduced from 20
    },
    modalIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
    },
    modalSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 16, // Reduced from 20
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 15,
        color: '#111827',
        marginLeft: 8,
    },
    modalList: {
        flex: 1,
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12, // Reduced from 14
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    modalItemActive: {
        backgroundColor: '#F5F3FF',
        borderColor: '#EDE9FE', // Matches design reference
        borderWidth: 1,
    },
    modalItemIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F9FAFB',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    modalItemText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    modalItemTextActive: {
        color: '#7C3AED',
    },
    modalItemSubtext: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    modalEmptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    modalEmptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 12,
    },
    // Search Container Styling
    searchContainerRelative: {
        position: 'relative',
        zIndex: 20,
    },
});

export default AdminCustomerManagement;

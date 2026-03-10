import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
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
import { adminAPI, getAPIErrorMessage } from '../../api';
import AdminShopDetailsScreen from './AdminShopDetailsScreen';
import { Skeleton } from '../../components/ui';

const AdminShopManagement = ({ showToast }) => {
    const [selectedShop, setSelectedShop] = useState(null);
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [totalShops, setTotalShops] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [showPageSizeDropdown, setShowPageSizeDropdown] = useState(false);

    const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30];

    const searchRef = useRef('');
    const isFirstRender = useRef(true);

    const doSearch = async (searchText, page, size) => {
        try {
            setLoading(true);
            const response = await adminAPI.getShops(searchText, page * size, size);
            setShops(response.data.shops || []);
            setTotalShops(response.data.total || 0);
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

    // Initial load
    useEffect(() => {
        doSearch('', 0, pageSize);
    }, []);

    // Android hardware back button: return to shop list from detail
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (selectedShop) {
                setSelectedShop(null);
                return true;
            }
            return false;
        });
        return () => backHandler.remove();
    }, [selectedShop]);

    // Page change
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        doSearch(searchRef.current, currentPage, pageSize);
    }, [currentPage]);

    const handleSearchChange = (text) => {
        setSearch(text);
        searchRef.current = text.trim();
        setCurrentPage(0);
        doSearch(text.trim(), 0, pageSize);
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setCurrentPage(0);
        doSearch(searchRef.current, 0, newSize);
    };

    const fetchShops = () => {
        doSearch(searchRef.current, currentPage, pageSize);
    };

    const handleClearSearch = () => {
        setSearch('');
        searchRef.current = '';
        setCurrentPage(0);
        doSearch('', 0, pageSize);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getCategoryStyle = (category) => {
        const cat = category?.toLowerCase() || '';
        if (cat.includes('grocery')) return { bg: '#D1FAE5', text: '#065F46' }; // Green
        if (cat.includes('electronics')) return { bg: '#DBEAFE', text: '#1E40AF' }; // Blue
        if (cat.includes('clothing')) return { bg: '#F3E8FF', text: '#6B21A8' }; // Purple
        if (cat.includes('restaurant') || cat.includes('food')) return { bg: '#FFEDD5', text: '#9A3412' }; // Orange
        if (cat.includes('pharmacy') || cat.includes('medical')) return { bg: '#FEE2E2', text: '#991B1B' }; // Red
        if (cat.includes('hardware')) return { bg: '#FEF9C3', text: '#854D0E' }; // Yellow
        if (cat.includes('book')) return { bg: '#E0E7FF', text: '#3730A3' }; // Indigo

        return { bg: '#F3F4F6', text: '#1F2937' }; // Gray (Default)
    };

    const renderShopItem = ({ item }) => {
        const catStyle = getCategoryStyle(item.category);

        return (
            <View style={styles.shopCard}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.locationContainer}>
                            <Ionicons name="location-outline" size={12} color="#4B5563" />
                            <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
                        </View>
                    </View>
                    <View style={[styles.categoryBadge, { backgroundColor: catStyle.bg }]}>
                        <Text style={[styles.categoryText, { color: catStyle.text }]}>
                            {item.category}
                        </Text>
                    </View>
                </View>

                {/* Card Content */}
                <View style={styles.cardContent}>
                    {/* Shop Code */}
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Business Code</Text>
                        <View style={styles.codeBadge}>
                            <Text style={styles.codeText}>{item.shop_code}</Text>
                        </View>
                    </View>

                    {/* GST */}
                    {item.gst_number && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>GST</Text>
                            <Text style={styles.infoValue}>{item.gst_number}</Text>
                        </View>
                    )}

                    {/* Owner Info Block */}
                    {item.owner && (
                        <View style={styles.ownerBlock}>
                            <View style={styles.ownerHeader}>
                                <Ionicons name="person-circle-outline" size={16} color="#374151" />
                                <Text style={styles.ownerLabel}>Owner Details</Text>
                            </View>
                            <View style={styles.ownerDetails}>
                                <Text style={styles.ownerName}>{item.owner.name}</Text>
                                <Text style={styles.ownerPhone}>{item.owner.phone}</Text>
                                <View style={styles.ownerTags}>
                                    {item.owner.verified && (
                                        <View style={[styles.miniBadge, { backgroundColor: '#D1FAE5' }]}>
                                            <Ionicons name="checkmark" size={10} color="#065F46" />
                                            <Text style={[styles.miniBadgeText, { color: '#065F46' }]}>Verified</Text>
                                        </View>
                                    )}
                                    {item.owner.flagged && (
                                        <View style={[styles.miniBadge, { backgroundColor: '#FEE2E2' }]}>
                                            <Ionicons name="flag" size={10} color="#991B1B" />
                                            <Text style={[styles.miniBadgeText, { color: '#991B1B' }]}>Flagged</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}

                    {/* View Details Button */}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => setSelectedShop(item)}
                    >
                        <Ionicons name="eye-outline" size={16} color="#374151" />
                        <Text style={styles.actionButtonText}>View Details</Text>
                    </TouchableOpacity>

                    {/* Footer */}
                    <View style={styles.cardFooter}>
                        <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                        <Text style={styles.footerText}>Created {formatDate(item.created_at)}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const totalPages = Math.ceil(totalShops / pageSize);


    // Inline Detail View — renders inside AdminPanelScreen (keeps header + bottom nav)
    if (selectedShop) {
        return (
            <AdminShopDetailsScreen
                shopId={selectedShop.id}
                shopName={selectedShop.name}
                shopCategory={selectedShop.category}
                shopCode={selectedShop.shop_code}
                onBack={() => setSelectedShop(null)}
                showToast={showToast}
            />
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => {
                    setShowPageSizeDropdown(false);
                    Keyboard.dismiss();
                }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchShops(); }} />
                }
            >
                {/* Header Text */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Business Management</Text>
                    <Text style={styles.headerSubtitle}>Manage and verify businesses</Text>
                </View>

                {/* Search Card */}
                <View style={styles.searchCard}>
                    <View style={styles.cardHeaderTitleRow}>
                        <Ionicons name="storefront" size={20} color="#000" />
                        <Text style={styles.cardHeaderTitle}>Businesses ({totalShops})</Text>
                    </View>

                    <View style={styles.searchRow}>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by name or location..."
                                value={search}
                                onChangeText={handleSearchChange}
                                returnKeyType="search"
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={handleClearSearch}>
                                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity
                            style={styles.refreshButton}
                            onPress={() => fetchShops()}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.refreshButtonText}>Refresh</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {loading && !refreshing && shops.length === 0 ? (
                    <View style={styles.listContent}>
                        {[1, 2, 3].map(i => (
                            <View key={i} style={[styles.shopCard, { padding: 16 }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <View style={{ flex: 1 }}>
                                        <Skeleton width="60%" height={20} style={{ marginBottom: 8 }} />
                                        <Skeleton width="40%" height={14} />
                                    </View>
                                    <Skeleton width={80} height={24} borderRadius={4} />
                                </View>
                                <Skeleton width="40%" height={16} style={{ marginBottom: 12 }} />
                                <View style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                                    <Skeleton width="50%" height={14} style={{ marginBottom: 8 }} />
                                    <Skeleton width="70%" height={14} />
                                </View>
                                <Skeleton width="100%" height={40} borderRadius={8} />
                            </View>
                        ))}
                    </View>
                ) : shops.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No businesses found</Text>
                    </View>
                ) : (
                    <View style={styles.listContent}>
                        {shops.map((item) => (
                            <View key={item.id}>{renderShopItem({ item })}</View>
                        ))}
                    </View>
                )}

                {/* Pagination Controls - Advanced */}
                <View style={styles.paginationContainer}>
                    {/* Top Row: Info + Page Size Selector */}
                    <View style={styles.paginationTopRow}>
                        <Text style={styles.paginationInfoText}>
                            Showing {shops.length === 0 ? 0 : currentPage * pageSize + 1} to{' '}
                            {Math.min((currentPage + 1) * pageSize, totalShops)} of{' '}
                            <Text style={styles.paginationInfoBold}>{totalShops} shops</Text>
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
                                                onPress={() => {
                                                    handlePageSizeChange(size);
                                                    setShowPageSizeDropdown(false);
                                                }}
                                            >
                                                <Text style={[styles.pageSizeDropdownItemText, pageSize === size && styles.pageSizeDropdownItemTextActive]}>{size}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.paginationDivider} />

                    {/* Bottom Row: Previous / Page Info / Next */}
                    <View style={styles.paginationBottomRow}>
                        <TouchableOpacity
                            style={[styles.pageButton, currentPage === 0 && styles.pageButtonDisabled]}
                            onPress={() => setCurrentPage(Math.max(0, currentPage - 1))}
                            disabled={currentPage === 0 || loading}
                        >
                            <Ionicons name="chevron-back" size={14} color={currentPage === 0 ? '#D1D5DB' : '#374151'} />
                            <Text style={[styles.pageButtonText, currentPage === 0 && styles.pageButtonTextDisabled]}>Previous</Text>
                        </TouchableOpacity>

                        <View style={styles.pageInfoBox}>
                            <Text style={styles.pageInfoLabel}>Page</Text>
                            <Text style={styles.pageInfoNumber}>{currentPage + 1} of {Math.max(1, Math.ceil(totalShops / pageSize))}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.pageButton, currentPage >= totalPages - 1 && styles.pageButtonDisabled]}
                            onPress={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                            disabled={currentPage >= totalPages - 1 || loading}
                        >
                            <Text style={[styles.pageButtonText, currentPage >= totalPages - 1 && styles.pageButtonTextDisabled]}>Next</Text>
                            <Ionicons name="chevron-forward" size={14} color={currentPage >= totalPages - 1 ? '#D1D5DB' : '#374151'} />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        paddingBottom: 20,
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
    searchCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        padding: 16,
    },
    cardHeaderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    cardHeaderTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
    },
    searchIcon: {
        marginRight: 6,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    refreshButton: {
        backgroundColor: '#111827',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    refreshButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
    listContent: {
        padding: 16,
        paddingBottom: 20,
    },
    shopCard: {
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
        marginBottom: 12,
    },
    headerLeft: {
        flex: 1,
        marginRight: 8,
    },
    shopName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    locationText: {
        fontSize: 12,
        color: '#4B5563',
        flex: 1,
    },
    categoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    categoryText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    cardContent: {
        gap: 8,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    infoValue: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
    codeBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    codeText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 12,
        color: '#374151',
    },
    ownerBlock: {
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
        marginTop: 4,
    },
    ownerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    ownerLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
    ownerDetails: {
        paddingLeft: 20, // Align with text
    },
    ownerName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    ownerPhone: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    ownerTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    miniBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        gap: 2,
    },
    miniBadgeText: {
        fontSize: 10,
        fontWeight: '500',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    footerText: {
        fontSize: 10,
        color: '#6B7280',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#6B7280',
        fontStyle: 'italic',
    },

    actionButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    actionButtonText: {
        color: '#374151',
        fontSize: 14,
        fontWeight: '500',
    },
    // Pagination Styles
    paginationContainer: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#fff',
        marginHorizontal: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    paginationInfoText: {
        fontSize: 13,
        color: '#6B7280',
        flexShrink: 1,
    },
    paginationInfoBold: {
        fontWeight: '600',
        color: '#374151',
    },
    paginationDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
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
        fontSize: 13,
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
        fontSize: 14,
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
});

export default AdminShopManagement;

// Shop Owner Dashboard Screen - Matching reference design exactly
import React, { useState, useEffect, useRef } from 'react';


import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Share,
    Switch,
    Keyboard,
    Pressable,
    Image,
    Animated,
    Dimensions,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Modal, Skeleton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { shopAPI, getAPIErrorMessage, customerAPI, productAPI, transactionAPI } from '../../api';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AddTransactionModal from './AddTransactionModal';
import ShopHeader from '../../components/shopowner/ShopHeader';
import ShopBottomNav from '../../components/shopowner/ShopBottomNav';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { saveFileToDevice } from '../../utils/downloadHelper';

import { colors, shadows } from '../../theme';
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STAT_CARD_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2; // 32 = padding (16*2), 12 = gap


const TransactionCard = ({ transaction, showNote = true }) => {
    const isCredit = transaction.type === 'credit';
    const isDebit = transaction.type === 'debit';
    const amountColor = isCredit ? '#10B981' : '#EF4444'; // Green for credit (taking), Red for debit (giving)? No wait.
    // Logic from image:
    // "Payment" (Black Badge) -> Green Amount (+40.00) -> This means money RECEIVED.
    // "Credit" (Red Badge) -> Red Amount (-20.00) -> This means money GIVEN (Udhaar).
    // So:
    // Debit (Take Payment) -> Payment Badge, Green Amount
    // Credit (Give Udhaar) -> Credit Badge, Red Amount

    const isPayment = isDebit; // Debit in our system = Take Payment
    const isUdhaar = isCredit; // Credit in our system = Give Udhaar

    const badgeLabel = isPayment ? 'Payment' : 'Credit';
    const badgeColor = isPayment ? '#000' : '#EF4444'; // Black vs Red
    const amountStyle = { color: isPayment ? '#10B981' : '#EF4444' };
    const sign = isPayment ? '+' : '-';

    const date = new Date(transaction.date);
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const items = transaction.products || transaction.items || [];

    return (
        <View style={styles.transactionCard}>
            <View style={styles.tCardTop}>
                <View>
                    <Text style={styles.tCardName}>{transaction.customer_name || 'Customer'}</Text>
                    <Text style={styles.tCardDate}>{dateStr}, {timeStr}</Text>
                </View>
                <View style={styles.tCardRight}>
                    <Text style={[styles.tCardAmount, amountStyle]}>{sign}₹{parseFloat(transaction.amount).toFixed(2)}</Text>
                    <View style={[styles.tCardBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.tCardBadgeText}>{badgeLabel}</Text>
                    </View>
                </View>
            </View>

            {items.length > 0 && (
                <View style={styles.tCardItems}>
                    <Text style={styles.tCardLabel}>Items:</Text>
                    <Text style={styles.tCardItemText}>
                        {items.map(i => `${i.name || 'Item'} (×${i.quantity})`).join('\n')}
                    </Text>
                </View>
            )}

            {showNote && transaction.note ? (
                <View style={styles.tCardNote}>
                    <Text style={styles.tCardLabel}>Note: <Text style={styles.tCardNoteText}>{transaction.note}</Text></Text>
                </View>
            ) : null}
        </View>
    );
};



const ShopOwnerDashboardScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout, switchRole } = useAuth();
    const [activeTab, setActiveTab] = useState('home');

    useFocusEffect(
        React.useCallback(() => {
            if (route.params?.tab) {
                setActiveTab(route.params.tab);
            }
            if (route.params?.successMessage) {
                showToast(route.params.successMessage);
            }

            // Clear params after processing
            if (route.params?.tab || route.params?.successMessage) {
                navigation.setParams({ tab: undefined, successMessage: undefined });
            }

            // Reload shops when screen gains focus
            loadShops();
        }, [route.params?.tab, route.params?.successMessage])
    );
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    // Tab Specific Loading States
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setKeyboardVisible(true);
            }
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
            }
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    const [isShareExpanded, setIsShareExpanded] = useState(false);
    const [dashboardStats, setDashboardStats] = useState(null);

    // Add Customer State
    const [customers, setCustomers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [newCustomerNickname, setNewCustomerNickname] = useState('');
    const [newCustomerType, setNewCustomerType] = useState('customer');
    const [addingCustomer, setAddingCustomer] = useState(false);

    // Add Transaction State
    const [transactions, setTransactions] = useState([]);
    const [addingTransaction, setAddingTransaction] = useState(false);
    const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [showPerPageDropdown, setShowPerPageDropdown] = useState(false);

    // Add Product State
    const [products, setProducts] = useState([]);
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [newProductPrice, setNewProductPrice] = useState('');
    const [addingProduct, setAddingProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const viewShotRef = useRef();
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef(null);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [toastType, setToastType] = useState('success');

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




    const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
    const formatShortDate = (dateString) => {
        const date = new Date(dateString);
        return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}`;
    };


    const loadDashboardStats = async (shopId) => {
        try {
            if (!shopId) return;
            const response = await shopAPI.getDashboard(shopId);
            setDashboardStats(response.data);
        } catch (error) {
            console.log('Failed to load dashboard stats:', error);
        }
    };

    // Load customers/products/transactions when switching tabs
    useEffect(() => {
        const currentShopId = user?.shop_id || (shops.length > 0 ? shops[0].id : null);

        if (currentShopId) {
            if (activeTab === 'customers' || activeTab === 'services') {
                loadCustomers(currentShopId, customers.length === 0);
            } else if (activeTab === 'products') {
                loadProducts(currentShopId, products.length === 0);
            } else if (activeTab === 'transactions') {
                loadTransactions(currentShopId, transactions.length === 0);
            }
        }
    }, [activeTab, user?.shop_id, shops]);

    const loadProducts = async (shopId, showLoading = true) => {
        try {
            if (!shopId) return;
            if (showLoading) setLoadingProducts(true);
            const response = await productAPI.getAll(shopId);
            setProducts(response.data || []);
        } catch (error) {
            console.log('Failed to load products:', error);
        } finally {
            if (showLoading) setLoadingProducts(false);
        }
    };

    const openAddProductModal = () => {
        setEditingProduct(null);
        setNewProductName('');
        setNewProductPrice('');
        setShowAddProductModal(true);
    };

    const openEditProductModal = (product) => {
        setEditingProduct(product);
        setNewProductName(product.name);
        setNewProductPrice(String(product.price));
        setShowAddProductModal(true);
    };

    const handleAddProduct = async () => {
        if (!newProductName.trim()) {
            showToast('Please enter product name');
            return;
        }
        if (!newProductPrice.trim()) {
            showToast('Please enter product price');
            return;
        }

        Keyboard.dismiss();

        setAddingProduct(true);
        try {
            const shopId = user?.shop_id || (shops.length > 0 ? shops[0].id : null);
            if (!shopId) {
                showToast('No shop found. Please create a shop first.');
                return;
            }

            if (editingProduct) {
                // UPDATE existing product
                await productAPI.update(shopId, editingProduct.id, {
                    name: newProductName.trim(),
                    price: parseFloat(newProductPrice)
                });
                setShowAddProductModal(false);
                showToast('Product updated successfully');
            } else {
                // CREATE new product
                await productAPI.create(shopId, {
                    name: newProductName.trim(),
                    price: parseFloat(newProductPrice)
                });
                setShowAddProductModal(false);
                showToast('Product added successfully');
            }

            setShowAddProductModal(false);
            setEditingProduct(null);
            setNewProductName('');
            setNewProductPrice('');
            loadProducts(shopId);
            loadDashboardStats(shopId); // Update stats (product count)
        } catch (error) {
            console.log('Failed to save product:', error);
            showToast(getAPIErrorMessage(error));
        } finally {
            setAddingProduct(false);
        }
    };

    const handleDeleteProduct = (product) => {
        Alert.alert(
            'Delete Product',
            `Are you sure you want to delete ${product.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const shopId = user?.shop_id || (shops.length > 0 ? shops[0].id : null);
                            if (shopId) {
                                await productAPI.delete(shopId, product.id);
                                loadProducts(shopId);
                                loadDashboardStats(shopId); // Refresh home stats
                                showToast('Item deleted successfully');
                            }
                        } catch (error) {
                            showToast('Failed to delete product');
                        }
                    }
                }
            ]
        );
    };

    const loadCustomers = async (shopId, showLoading = true) => {
        try {
            if (!shopId) return;
            if (showLoading) setLoadingCustomers(true);
            const response = await customerAPI.getAll(shopId);
            const resData = response.data || {};
            setCustomers(resData.customers || resData || []);
        } catch (error) {
            console.log('Failed to load customers:', error);
        } finally {
            if (showLoading) setLoadingCustomers(false);
        }
    };

    const loadTransactions = async (shopId, showLoading = true) => {
        try {
            if (!shopId) return;
            if (showLoading) setLoadingTransactions(true);
            const response = await transactionAPI.getAll(shopId);
            const sorted = (response.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));

            const enriched = sorted.map(t => {
                const customer = customers.find(c => c.id === t.customer_id);
                return { ...t, customer_name: customer?.name || t.customer_name || 'Unknown' };
            });
            setTransactions(enriched);
        } catch (error) {
            console.log('Failed to load transactions:', error);
        } finally {
            if (showLoading) setLoadingTransactions(false);
        }
    };

    // New function that accepts customers list as parameter (avoids race condition)
    const loadTransactionsWithCustomers = async (shopId, customersList) => {
        try {
            if (!shopId) return;
            const response = await transactionAPI.getAll(shopId);
            const sorted = (response.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));

            const enriched = sorted.map(t => {
                const customer = customersList.find(c => c.id === t.customer_id);
                return { ...t, customer_name: customer?.name || t.customer_name || 'Unknown' };
            });
            setTransactions(enriched);
        } catch (error) {
            console.log('Failed to load transactions:', error);
        }
    };

    const handleAddCustomer = async () => {
        if (!newCustomerName.trim()) {
            showToast('Please enter customer name');
            return;
        }
        if (!newCustomerPhone.trim() || newCustomerPhone.length !== 10) {
            showToast('Please enter a valid phone number');
            return;
        }

        Keyboard.dismiss();

        setAddingCustomer(true);
        try {
            const shopId = user?.shop_id || (shops.length > 0 ? shops[0].id : null);
            if (!shopId) {
                showToast('No shop found. Please create a shop first.', 'error');
                return;
            }

            const savedName = newCustomerName.trim();
            const savedPhone = newCustomerPhone.trim();

            const res = await customerAPI.create(shopId, {
                name: savedName,
                phone: savedPhone,
                nickname: newCustomerNickname.trim() || null,
                type: newCustomerType
            });

            const newlyCreatedCustomerId = res.data?.id;

            setShowAddCustomerModal(false);
            showToast('User added successfully');

            // Clear state
            setNewCustomerName('');
            setNewCustomerPhone('');
            setNewCustomerNickname('');
            setNewCustomerType('customer');

            loadCustomers(shopId); // Refresh list
            loadDashboardStats(shopId); // Refresh home stats

            // After successful add, ask to send WhatsApp
            setTimeout(() => {
                Alert.alert(
                    'Send Invitation & Verify',
                    `Would you like to send a welcome message and verification link to ${savedName} on WhatsApp?`,
                    [
                        { text: 'Skip', style: 'cancel' },
                        {
                            text: 'Send Link',
                            onPress: () => handleSendVerification(shopId, newlyCreatedCustomerId, savedPhone, savedName)
                        }
                    ]
                );
            }, 500);
        } catch (error) {
            console.log('Failed to add customer:', error);
            showToast(getAPIErrorMessage(error));
        } finally {
            setAddingCustomer(false);
        }
    };

    const handleVerifyWhatsApp = async (phone, name) => {
        const targetPhone = phone || newCustomerPhone;
        const targetName = name || newCustomerName;

        if (!targetPhone || targetPhone.length !== 10) {
            showToast('Please enter a valid 10-digit number');
            return;
        }
        const currentShop = shops.find(s => s.id === user?.shop_id) || shops[0];
        const shopName = currentShop?.name || 'our store';
        const message = `Hello ${targetName || 'Customer'}, this is ${shopName}. We are adding you to our digital ledger on ShopMunim. Please confirm if this is your correct number.`;
        const url = `whatsapp://send?phone=91${targetPhone}&text=${encodeURIComponent(message)}`;

        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                // Fallback to web link
                await Linking.openURL(`https://wa.me/91${targetPhone}?text=${encodeURIComponent(message)}`);
            }
        } catch (error) {
            console.log('WhatsApp Error:', error);
            showToast('Could not open WhatsApp');
        }
    };

    const handleSendVerification = async (shopId, customerId, phone, name) => {
        try {
            const response = await customerAPI.sendVerification(shopId, customerId);
            const link = response.data?.verification_link;

            if (link) {
                const currentShop = shops.find(s => s.id === user?.shop_id) || shops[0];
                const shopName = currentShop?.name || '';
                const message = `Hello ${name || 'Customer'},\n\nWelcome to Shop ${shopName}! We've added you to our digital ledger on ShopMunim.\n\nPlease click the link below to verify your number and activate your account:\n${link}\n\nThank you!`;

                const url = `whatsapp://send?phone=91${phone}&text=${encodeURIComponent(message)}`;
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                    await Linking.openURL(url);
                } else {
                    await Linking.openURL(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`);
                }
                showToast('Verification link sent successfully');
            } else {
                showToast('Failed to generate verification link');
            }
        } catch (error) {
            console.log('Verification Link Error:', error);
            showToast(getAPIErrorMessage(error));
        }
    };

    const loadShops = async () => {
        try {
            const response = await shopAPI.getAll();
            const shopList = response.data || [];
            setShops(shopList);

            if (shopList.length > 0) {
                const shopId = shopList[0].id;
                loadDashboardStats(shopId);
                // Load customers first, then transactions (transactions need customer names)
                const customersRes = await customerAPI.getAll(shopId);
                const custData = customersRes.data || {};
                const customersList = custData.customers || custData || [];
                setCustomers(customersList);
                // Now load transactions with customer names
                loadTransactionsWithCustomers(shopId, customersList);
            }
        } catch (error) {
            console.log('Failed to load shops:', error);
            if (!refreshing) { // Don't alert on pull-to-refresh, just log
                showToast(getAPIErrorMessage(error), 'error');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        setCurrentPage(1);
        loadShops();
        // If we have a current shop, refresh its stats and data explicitly too
        if (user?.shop_id || (shops.length > 0 && shops[0].id)) {
            const shopId = user?.shop_id || shops[0].id;
            loadDashboardStats(shopId);
            if (activeTab === 'customers') loadCustomers(shopId);
            if (activeTab === 'products') loadProducts(shopId);
            if (activeTab === 'home') loadTransactions(shopId);
        }
    };

    const handleShareQr = async () => {
        try {
            if (viewShotRef.current) {
                const uri = await viewShotRef.current.capture();
                if (uri) {
                    await Sharing.shareAsync(uri);
                }
            }
        } catch (error) {
            console.log('Share error:', error);
            Alert.alert('Error', 'Failed to share QR code');
        }
    };

    const handleDownloadQr = async () => {
        try {
            if (!viewShotRef.current) {
                showToast('QR code not ready');
                return;
            }
            const uri = await viewShotRef.current.capture();
            if (!uri) {
                showToast('Failed to capture QR code');
                return;
            }
            const base64Img = await LegacyFileSystem.readAsStringAsync(uri, {
                encoding: LegacyFileSystem.EncodingType.Base64,
            });
            const currentShop = shops.find(s => s.id === user?.shop_id) || shops[0];
            const shopName = currentShop?.name || 'Business';
            const shopCode = currentShop?.shop_code || '';
            const shopCategory = currentShop?.category || '';

            const html = `<html><head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:60px 40px;font-family:sans-serif;text-align:center;">
                <div style="max-width:400px;margin:0 auto;border:2px solid #E5E7EB;border-radius:20px;padding:40px 30px;">
                    <h1 style="color:#111827;font-size:26px;margin:0 0 4px;">Business ${shopName}</h1>
                    ${shopCategory ? `<div style="margin:8px auto 16px;"><span style="background:#EEF2FF;color:#6366F1;font-size:12px;padding:4px 14px;border-radius:20px;">${shopCategory}</span></div>` : ''}
                    <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">Scan QR Code to connect with our business</p>
                    <div style="background:#F9FAFB;border-radius:16px;padding:24px;display:inline-block;">
                        <img src="data:image/jpeg;base64,${base64Img}" style="width:220px;height:220px;" />
                    </div>
                    <div style="margin-top:20px;background:#F3F4F6;border-radius:10px;padding:10px 20px;display:inline-block;">
                        <span style="color:#9CA3AF;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Business Code</span><br/>
                        <span style="color:#111827;font-size:20px;font-weight:bold;letter-spacing:3px;">${shopCode}</span>
                    </div>
                    <p style="color:#D1D5DB;font-size:11px;margin-top:24px;">Powered by <strong style="color:#9CA3AF;">ShopMunim</strong></p>
                </div>
            </body></html>`;

            const { uri: pdfUri } = await Print.printToFileAsync({ html });

            // Read PDF as base64
            const pdfBase64 = await LegacyFileSystem.readAsStringAsync(pdfUri, {
                encoding: LegacyFileSystem.EncodingType.Base64,
            });

            // Save to device with notification (same as PDF download)
            const fileName = `QR_Shop_${shopName.replace(/\s+/g, '_')}.pdf`;
            const result = await saveFileToDevice(fileName, pdfBase64, 'application/pdf');
            if (!result.success) {
                showToast('Download cancelled');
            }
        } catch (error) {
            console.log('Download error:', error);
            showToast('Download failed: ' + (error?.message || String(error)));
        }
    };

    const handlePrintQr = async () => {
        try {
            if (!viewShotRef.current) {
                showToast('QR code not ready');
                return;
            }
            const uri = await viewShotRef.current.capture();
            if (!uri) {
                showToast('Failed to capture QR code');
                return;
            }
            const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
                encoding: LegacyFileSystem.EncodingType.Base64,
            });
            const currentShop = shops.find(s => s.id === user?.shop_id) || shops[0];
            const shopName = currentShop?.name || 'Business';
            const shopCode = currentShop?.shop_code || '';
            const shopCategory = currentShop?.category || '';

            const html = `<html><head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:60px 40px;font-family:sans-serif;text-align:center;">
                <div style="max-width:400px;margin:0 auto;border:2px solid #E5E7EB;border-radius:20px;padding:40px 30px;">
                    <h1 style="color:#111827;font-size:26px;margin:0 0 4px;">Business ${shopName}</h1>
                    ${shopCategory ? `<div style="margin:8px auto 16px;"><span style="background:#EEF2FF;color:#6366F1;font-size:12px;padding:4px 14px;border-radius:20px;">${shopCategory}</span></div>` : ''}
                    <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">Scan QR Code to connect with our business</p>
                    <div style="background:#F9FAFB;border-radius:16px;padding:24px;display:inline-block;">
                        <img src="data:image/jpeg;base64,${base64}" style="width:220px;height:220px;" />
                    </div>
                    <div style="margin-top:20px;background:#F3F4F6;border-radius:10px;padding:10px 20px;display:inline-block;">
                        <span style="color:#9CA3AF;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Shop Code</span><br/>
                        <span style="color:#111827;font-size:20px;font-weight:bold;letter-spacing:3px;">${shopCode}</span>
                    </div>
                    <p style="color:#D1D5DB;font-size:11px;margin-top:24px;">Powered by <strong style="color:#9CA3AF;">ShopMunim</strong></p>
                </div>
            </body></html>`;

            await Print.printAsync({ html });
        } catch (error) {
            console.log('Print error:', error);
            showToast('Print failed: ' + (error?.message || String(error)));
        }
    };

    const copyToClipboard = async () => {
        const currentShop = shops.find(s => s.id === user?.shop_id) || shops[0];
        const shopCode = currentShop?.shop_code || 'Code';

        const link = `https://shopmunim-backend.onrender.com/api/public/connect/${shopCode}`;
        await Clipboard.setStringAsync(link);
        showToast('Link copied to clipboard!');
    };

    const handleShareLink = async (type) => {
        const currentShop = shops.find(s => s.id === user?.shop_id) || shops[0];
        const shopCode = currentShop?.shop_code || 'Code';

        const link = `https://shopmunim-backend.onrender.com/api/public/connect/${shopCode}`;
        const message = `Check out my shop "${currentShop?.name || 'Shop'}" on ShopMunim! Code: ${shopCode}\nLink: ${link}`;
        try {
            if (type === 'whatsapp') {
                const waUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
                const canOpen = await Linking.canOpenURL(waUrl);
                if (canOpen) {
                    await Linking.openURL(waUrl);
                } else {
                    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
                }
            } else {
                await Share.share({ message });
            }
        } catch (error) {
            showToast('Failed to share link', 'error');
        }
    };

    // Header Component replaced by imported ShopHeader


    // Empty State Card - Matching reference exactly
    const EmptyStateCard = () => (
        <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Welcome to ShopMunim!</Text>
            <Text style={styles.emptyDescription}>Create your first shop to get started</Text>
            <TouchableOpacity style={styles.createShopButton} onPress={() => navigation.navigate('CreateShop')}>
                <Text style={styles.createShopText}>+ Create New Business</Text>
            </TouchableOpacity>
        </View>
    );

    // Home Tab Content
    const renderHomeContent = () => {
        const hasShops = shops.length > 0;

        if (loading && !refreshing) {
            return (
                <ScrollView
                    style={styles.tabContent}
                    contentContainerStyle={styles.dashboardContainer}
                >
                    {/* Stats Cards Row 1 Skeleton */}
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Skeleton width={32} height={32} borderRadius={16} style={{ marginBottom: 12 }} />
                            <Skeleton width="60%" height={28} style={{ marginBottom: 8 }} />
                            <Skeleton width="40%" height={14} />
                        </View>
                        <View style={styles.statCard}>
                            <Skeleton width={32} height={32} borderRadius={16} style={{ marginBottom: 12 }} />
                            <Skeleton width="60%" height={28} style={{ marginBottom: 8 }} />
                            <Skeleton width="40%" height={14} />
                        </View>
                    </View>

                    {/* Stats Cards Row 2 Skeleton */}
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Skeleton width={32} height={32} borderRadius={16} style={{ marginBottom: 12 }} />
                            <Skeleton width="70%" height={28} style={{ marginBottom: 8 }} />
                            <Skeleton width="50%" height={14} style={{ marginBottom: 12 }} />
                            <Skeleton width="80%" height={40} borderRadius={8} />
                        </View>
                        <View style={styles.statCard}>
                            <Skeleton width={32} height={32} borderRadius={16} style={{ marginBottom: 12 }} />
                            <Skeleton width="40%" height={28} style={{ marginBottom: 8 }} />
                            <Skeleton width="80%" height={14} />
                        </View>
                    </View>

                    {/* Quick Actions Skeleton */}
                    <Skeleton width="40%" height={20} style={{ marginVertical: 16 }} />
                    <View style={styles.quickActionsRow}>
                        <Skeleton width="48%" height={48} borderRadius={12} />
                        <Skeleton width="48%" height={48} borderRadius={12} />
                    </View>

                    {/* Recent Activity Skeleton */}
                    <View style={[styles.recentActivityCard, { marginTop: 24, padding: 16 }]}>
                        <Skeleton width="50%" height={20} style={{ marginBottom: 16 }} />
                        {[1, 2, 3].map(i => (
                            <View key={i} style={{ marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Skeleton width="40%" height={16} />
                                    <Skeleton width="30%" height={16} />
                                </View>
                                <Skeleton width="20%" height={20} borderRadius={4} alignSelf="flex-end" />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            );
        }

        if (!hasShops) {
            return (
                <ScrollView
                    style={styles.tabContent}
                    contentContainerStyle={styles.tabContentContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <EmptyStateCard />
                    {/* Spacer for bottom nav */}
                    <View style={{ height: 100 }} />
                </ScrollView>
            );
        }

        // Dashboard with stats when shop exists
        return (
            <ScrollView
                style={styles.tabContent}
                contentContainerStyle={styles.dashboardContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Stats Cards Row 1 */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Ionicons name="people-outline" size={28} color="#6366F1" />
                        <Text
                            style={styles.statNumber}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                        >
                            {dashboardStats?.total_customers || customers.length || 0}
                        </Text>
                        <Text style={styles.statLabel}>Customers</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Ionicons name="cube-outline" size={28} color="#3B82F6" />
                        <Text
                            style={[styles.statNumber, { color: '#3B82F6' }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                        >
                            {dashboardStats?.total_products || products.length || 0}
                        </Text>
                        <Text style={styles.statLabel}>Products</Text>
                    </View>
                </View>

                {/* Stats Cards Row 2 */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <View style={[styles.rupeeCircle, { backgroundColor: '#EF4444' }]}>
                            <Text style={[styles.rupeeIcon, { color: '#fff' }]}>₹</Text>
                        </View>
                        <Text
                            style={[styles.statNumber, { color: '#EF4444' }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                        >
                            ₹{Math.abs(customers.reduce((acc, c) => acc + (c.balance < 0 ? c.balance : 0), 0)).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </Text>
                        <Text style={styles.statLabel}>Pending Dues</Text>

                        <TouchableOpacity
                            style={styles.transactionsButton}
                            onPress={() => setActiveTab('transactions')}
                        >
                            <Ionicons name="receipt-outline" size={14} color="#fff" />
                            <Text style={styles.transactionsButtonText}>Transactions</Text>
                        </TouchableOpacity>

                    </View>
                    <View style={styles.statCard}>
                        {/* With Dues - Orange Warning */}
                        <Ionicons name="warning-outline" size={28} color="#F59E0B" style={{ marginBottom: 4 }} />
                        <Text
                            style={[styles.statNumber, { color: '#F59E0B' }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                        >
                            {customers.filter(c => c.balance < 0).length}
                        </Text>
                        <Text style={styles.statLabel2}>Total Customers With Dues</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActionsRow}>
                    <TouchableOpacity
                        style={styles.quickActionBlue}
                        onPress={() => {
                            setNewCustomerName('');
                            setNewCustomerPhone('');
                            setNewCustomerNickname('');
                            setNewCustomerType('customer');
                            setShowAddCustomerModal(true);
                        }}
                    >
                        <Ionicons name="person-add-outline" size={20} color="#fff" />
                        <Text style={styles.quickActionText}>Add </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.quickActionGreen}
                        onPress={() => setShowAddTransactionModal(true)}
                    >
                        <Ionicons name="add-circle-outline" size={20} color="#fff" />
                        <Text style={styles.quickActionText}>Add Transaction</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Activity */}
                <View style={styles.recentActivityCard}>
                    <Text style={styles.recentActivityTitle}>Recent Activity</Text>
                    {transactions.length === 0 ? (
                        <Text style={styles.recentActivityEmpty}>No transactions yet</Text>
                    ) : (
                        <View style={styles.transactionsList}>
                            {transactions.slice(0, 5).map((t) => (
                                <TransactionCard key={t.id} transaction={t} showNote={false} />
                            ))}
                        </View>
                    )}
                </View>

                {/* Spacer for bottom nav */}
                <View style={{ height: 120 }} />
            </ScrollView>
        );
    };

    // Products Tab Content
    const renderProductsContent = () => {
        const hasShops = shops.length > 0;

        if (!hasShops) {
            return (
                <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
                    <EmptyStateCard />
                    <View style={{ height: 100 }} />
                </ScrollView>
            );
        }

        if ((loading || loadingProducts) && !refreshing) {
            return (
                <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabPadding}>
                    <View style={styles.productsCard}>
                        <View style={styles.productsCardHeader}>
                            <View style={styles.tabHeaderLeft}>
                                <Skeleton width="40%" height={24} style={{ marginBottom: 4 }} />
                                <Skeleton width="70%" height={16} />
                            </View>
                            <Skeleton width={100} height={36} borderRadius={6} />
                        </View>
                        <View style={styles.productsList}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <View key={i} style={[styles.productItem, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                                    <View style={{ flex: 1 }}>
                                        <Skeleton width="60%" height={20} style={{ marginBottom: 8 }} />
                                        <Skeleton width="30%" height={24} borderRadius={12} />
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <Skeleton width={60} height={32} borderRadius={6} />
                                        <Skeleton width={60} height={32} borderRadius={6} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            );
        }

        return (
            <ScrollView
                style={styles.tabContent}
                contentContainerStyle={styles.tabPadding}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Products Parent Card */}
                <View style={styles.productsCard}>
                    {/* Header Row */}
                    <View style={styles.productsCardHeader}>
                        <View style={styles.tabHeaderLeft}>
                            <Text style={styles.tabHeaderTitle}>Products</Text>
                            <Text style={styles.tabHeaderSubtitle}>Manage your shop's products and pricing</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.addButtonBlue}
                            onPress={openAddProductModal}
                        >
                            <Text style={styles.addButtonText}>+ Add Product</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Products List or Empty State */}
                    {products.length === 0 ? (
                        <View style={styles.productsEmptyState}>
                            <Text style={styles.tabEmptyText}>No products added yet.</Text>
                            <Text style={styles.tabEmptySubtext}>Add your first product to get started!</Text>
                        </View>
                    ) : (
                        <View style={styles.productsList}>
                            {products.map((product) => (
                                <View key={product.id} style={styles.productItem}>
                                    <View style={styles.productInfoRow}>
                                        <Text style={styles.productName}>{product.name}</Text>
                                        <View style={styles.priceBadge}>
                                            <Text style={styles.priceText}>₹{parseFloat(product.price).toFixed(2)}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.productActionsRow}>
                                        <TouchableOpacity
                                            style={styles.actionButtonOutline}
                                            onPress={() => openEditProductModal(product)}
                                        >
                                            <Text style={styles.actionButtonTextOutline}>Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.actionButtonRed}
                                            onPress={() => handleDeleteProduct(product)}
                                        >
                                            <Text style={styles.actionButtonTextRed}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Spacer for bottom nav */}
                <View style={{ height: 120 }} />
            </ScrollView>
        );
    };

    // Customers Tab Content
    const renderCustomersContent = () => {
        const hasShops = shops.length > 0;

        // Filter customers based on search query and type
        const filteredCustomers = customers.filter(customer =>
            customer && 
            (!customer.type || customer.type === 'customer') && 
            (
                customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                customer.phone?.includes(searchQuery) ||
                customer.nickname?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );

        if (!hasShops) {
            return (
                <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
                    <EmptyStateCard />
                    <View style={{ height: 100 }} />
                </ScrollView>
            );
        }

        if ((loading || loadingCustomers) && !refreshing) {
            return (
                <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabPadding}>
                    <View style={styles.customersHeader}>
                        <Skeleton width="40%" height={28} />
                        <View style={styles.customersHeaderRight}>
                            <Skeleton width={32} height={32} borderRadius={16} />
                            <Skeleton width={80} height={36} borderRadius={6} />
                        </View>
                    </View>
                    <Skeleton width="100%" height={44} borderRadius={8} style={{ marginBottom: 16 }} />
                    <View style={styles.customersList}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <View key={i} style={[styles.customerItem, { flexDirection: 'row', alignItems: 'center' }]}>
                                <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Skeleton width="50%" height={16} style={{ marginBottom: 6 }} />
                                    <Skeleton width="40%" height={14} style={{ marginBottom: 6 }} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Skeleton width={60} height={20} borderRadius={10} />
                                        <Skeleton width={60} height={16} />
                                    </View>
                                </View>
                                <Skeleton width={24} height={24} borderRadius={12} />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            );
        }

        return (
            <ScrollView
                style={styles.tabContent}
                contentContainerStyle={styles.tabPadding}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Customers Header */}
                <View style={styles.customersHeader}>
                    <Text style={styles.customersTitle}>Customers</Text>
                    <View style={styles.customersHeaderRight}>
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{filteredCustomers.length}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.addButtonBlue}
                            onPress={() => {
                                setNewCustomerName('');
                                setNewCustomerPhone('');
                                setNewCustomerNickname('');
                                setNewCustomerType('customer');
                                setShowAddCustomerModal(true);
                            }}
                        >
                            <Ionicons name="person-add-outline" size={16} color="#fff" />
                            <Text style={styles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or phone number..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Empty State or List */}
                {filteredCustomers.length === 0 && searchQuery ? (
                    <View style={styles.customersEmptyState}>
                        <Text style={styles.tabEmptyText}>No matching customers found</Text>
                    </View>
                ) : filteredCustomers.length === 0 ? (
                    <View style={styles.customersEmptyState}>
                        <Ionicons name="people" size={48} color="#6366F1" />
                        <Text style={styles.tabEmptyText}>No customers yet</Text>
                        <Text style={styles.tabEmptySubtext}>Add your first customer to get started</Text>
                    </View>
                ) : (
                    <View style={styles.customersList}>
                        {filteredCustomers.map((customer) => (
                            <View key={customer.id} style={styles.customerItem}>
                                <View style={styles.customerAvatar}>
                                    <Text style={styles.customerAvatarText}>
                                        {customer.name?.charAt(0)?.toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.customerInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.customerName}>
                                            {customer.name}
                                            {customer.nickname ? ` (${customer.nickname})` : ''}
                                        </Text>
                                    </View>
                                    <Text style={styles.customerPhone}>+91 {customer.phone}</Text>
                                    <View style={styles.customerBalance}>
                                        <View style={[
                                            styles.statusBadge,
                                            (customer.balance || 0) == 0 ? styles.statusBadgeClear :
                                                (customer.balance || 0) < 0 ? styles.statusBadgeDue : styles.statusBadgeAdvance,
                                        ]}>
                                            <Text style={[
                                                styles.statusBadgeText,
                                                (customer.balance || 0) == 0 ? styles.statusBadgeTextClear :
                                                    (customer.balance || 0) < 0 ? styles.statusBadgeTextDue : styles.statusBadgeTextAdvance
                                            ]}>
                                                {(customer.balance || 0) == 0 ? 'Clear' : (customer.balance || 0) < 0 ? 'Dues' : 'Credit'}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.balanceAmount,
                                                (customer.balance || 0) == 0 ? { color: '#6B7280' } :
                                                    (customer.balance || 0) < 0 ? { color: '#EF4444' } : { color: '#10B981' },
                                            ]}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit={true}
                                            minimumFontScale={0.5}
                                        >
                                            {(customer.balance || 0) == 0 ? '' : (customer.balance || 0) > 0 ? '+' : '-'}&#8377;{Math.abs(customer.balance || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.customerRightSide}>
                                    <TouchableOpacity
                                        style={styles.arrowButton}
                                        onPress={() => handleCustomerSelect(customer)}
                                    >
                                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
                {/* Spacer for bottom nav */}
                <View style={{ height: 110 }} />
            </ScrollView>
        );
    };

    // Transactions Tab Content
    const renderTransactionsContent = () => {
        const hasShops = shops.length > 0;

        if (!hasShops) {
            return (
                <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
                    <EmptyStateCard />
                    <View style={{ height: 100 }} />
                </ScrollView>
            );
        }

        if ((loading || loadingTransactions) && !refreshing) {
            return (
                <ScrollView style={styles.tabContent} contentContainerStyle={styles.dashboardContainer}>
                    <View style={styles.transactionsHeader}>
                        <Skeleton width="50%" height={24} />
                        <Skeleton width={40} height={24} borderRadius={12} />
                    </View>
                    <View style={styles.transactionsList}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <View key={i} style={[styles.transactionCard, { padding: 16 }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <Skeleton width="60%" height={16} style={{ marginBottom: 6 }} />
                                        <Skeleton width="40%" height={14} />
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Skeleton width={80} height={20} style={{ marginBottom: 6 }} />
                                        <Skeleton width={60} height={20} borderRadius={4} />
                                    </View>
                                </View>
                                <Skeleton width="100%" height={14} style={{ marginTop: 8 }} />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            );
        }

        const totalItems = transactions.length;
        const totalPages = Math.ceil(totalItems / perPage);
        const startIdx = (currentPage - 1) * perPage;
        const endIdx = Math.min(startIdx + perPage, totalItems);
        const paginatedTx = transactions.slice(startIdx, endIdx);

        return (
            <ScrollView style={styles.tabContent} contentContainerStyle={styles.dashboardContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                keyboardShouldPersistTaps="handled"
            >
                <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                        if (showPerPageDropdown) setShowPerPageDropdown(false);
                    }}
                >
                    {/* Transactions Header */}
                    <View style={styles.transactionsHeader}>
                        <Text style={styles.transactionsTitle}>All Transactions</Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{transactions.length}</Text>
                        </View>
                    </View>

                    {/* Transactions List */}
                    {transactions.length === 0 ? (
                        <View style={styles.transactionsEmptyState}>
                            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                <FontAwesome name="rupee" size={28} color="#000000" />
                            </View>
                            <Text style={styles.tabEmptyText}>No transactions yet</Text>
                            <Text style={styles.tabEmptySubtext}>Record your first transaction!</Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.transactionsList}>
                                {paginatedTx.map((t) => (
                                    <TransactionCard key={t.id} transaction={t} />
                                ))}
                            </View>

                            {/* Pagination Card */}
                            {totalItems > 0 && (
                                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8, marginHorizontal: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, borderWidth: 1, borderColor: '#F3F4F6' }}>
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
                    )}

                    {/* Spacer for bottom nav */}
                    <View style={{ height: 120 }} />
                </Pressable>
            </ScrollView>
        );
    };



    // Account Tab Content - Matching reference exactly
    const renderAccountContent = () => {
        if (!user) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                </View>
            );
        }

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

        const currentShop = shops.find(s => s.id === user?.shop_id) || shops[0];

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
                            <Text style={styles.profilePhoneText}>+91 {user?.phone || '1234567890'}</Text>
                        </View>

                        <View style={styles.rightRoleBadge}>
                            <Text style={styles.rightRoleBadgeText}>Business</Text>
                        </View>
                    </View>
                </View>



                {/* Share Your Shop Card */}
                <View style={styles.shareCard}>
                    <View style={styles.shareHeader}>
                        <View style={styles.shareIconContainer}>
                            <Ionicons name="storefront" size={24} color="#8B5CF6" />
                        </View>
                        <View style={styles.shareTitleContainer}>
                            <Text style={styles.shareTitle}>Share Your Business</Text>
                            {!isShareExpanded && (
                                <Text style={styles.shareSubtitle}>
                                    Generate QR code and shareable link for users to connect
                                </Text>
                            )}
                        </View>
                    </View>

                    {isShareExpanded ? (
                        <View style={styles.shareExpandedContent}>
                            <View style={styles.shareBlueHeader}>
                                <TouchableOpacity
                                    style={styles.collapseButton}
                                    onPress={() => setIsShareExpanded(false)}
                                >
                                    <Ionicons name="chevron-up" size={20} color="#fff" />
                                    <Text style={styles.collapseButtonText}>Hide QR Code & Share Options</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Card 1: Shop Info Card */}
                            <View style={styles.shopInfoCard}>
                                <View style={[styles.cardHeaderRow, { justifyContent: 'space-between' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="qr-code-outline" size={20} color="#000" />
                                        <Text style={styles.cardTitle}>Business Info</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => navigation.navigate('CreateShop', { shop: currentShop })}>
                                        <Ionicons name="create-outline" size={20} color="#4B5563" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.shopDetailsContent}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <Text style={[styles.shopNameLarge, { marginBottom: 0, flex: 1 }]}>{currentShop?.name || 'Shop Name'}</Text>
                                        <View style={styles.shopCodeBadge}>
                                            <Text style={styles.shopCodeText}>Code: {currentShop?.shop_code || '...'}</Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.shopLocationText, { marginBottom: 12 }]}>{currentShop?.location || 'Location'}</Text>

                                    <View style={styles.categoryBadgeSmall}>
                                        <Text style={styles.categoryBadgeTextSmall}>{currentShop?.category || 'Category'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Card 2: QR Code Card */}
                            <View style={styles.qrCodeCard}>
                                <Text style={styles.qrCardTitle}>QR Code</Text>
                                <Text style={styles.qrCardSubtitle}>Users can scan this code to connect to your business instantly</Text>

                                <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
                                    <View style={styles.qrContainer}>
                                        <QRCode
                                            value={`https://shopmunim-backend.onrender.com/api/public/connect/${currentShop?.shop_code || 'Code'}`}
                                            size={200}
                                            backgroundColor="white"
                                            color="black"
                                        />
                                    </View>
                                </ViewShot>

                                <View style={styles.qrActionsRow}>
                                    <TouchableOpacity style={styles.qrActionButton} onPress={handleDownloadQr}>
                                        <Ionicons name="download-outline" size={18} color="#374151" />
                                        <Text style={styles.qrActionText}>Download</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.qrActionButton} onPress={handlePrintQr}>
                                        <Ionicons name="print-outline" size={18} color="#374151" />
                                        <Text style={styles.qrActionText}>Print</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.qrFooter}>
                                    <Text style={styles.qrFooterEmoji}>📱</Text>
                                    <Text style={styles.qrFooterText}>Users scan this with any QR scanner or camera app</Text>
                                </View>
                            </View>

                            {/* Share Link Section */}
                            <View style={styles.linkSection}>
                                <Text style={styles.sectionHeader}>Shareable Link</Text>
                                <Text style={styles.sectionSubHeader}>Share this link via WhatsApp, SMS, or social media</Text>

                                <View style={styles.linkBox}>
                                    <Ionicons name="link-outline" size={20} color="#6B7280" />
                                    <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="tail">
                                        https://shopmunim-backend.onrender.com/api/public/connect/{currentShop?.shop_code || 'Code'}
                                    </Text>
                                </View>

                                <TouchableOpacity style={styles.copyLinkButton} onPress={copyToClipboard}>
                                    <Ionicons name="copy-outline" size={18} color="#374151" />
                                    <Text style={styles.copyLinkText}>Copy Link</Text>
                                </TouchableOpacity>

                                <View style={styles.shareButtonsRow}>
                                    <TouchableOpacity style={styles.whatsappButton} onPress={() => handleShareLink('whatsapp')}>
                                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                                        <Text style={styles.whatsappButtonText}>WhatsApp</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.nativeShareButton} onPress={() => handleShareLink('native')}>
                                        <Ionicons name="share-outline" size={18} color="#374151" />
                                        <Text style={styles.nativeShareText}>Share</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Blue Info Box */}
                                <View style={styles.infoBoxBlue}>
                                    <Text style={styles.infoBoxTitle}>✨ Benefits</Text>
                                    <Text style={styles.infoBoxItem}>• Users can see your business & items</Text>
                                    <Text style={styles.infoBoxItem}>• They join your list automatically</Text>
                                    <Text style={styles.infoBoxItem}>• Chat and request items/payments</Text>
                                    <Text style={styles.infoBoxItem}>• No manual user add required!</Text>
                                </View>
                            </View>

                            {/* Marketing Tips */}
                            <View style={styles.marketingSection}>
                                <Text style={styles.marketingTitle}>Marketing Tips</Text>

                                <View style={[styles.marketingCard, { backgroundColor: '#FFFBEB' }]}>
                                    <Text style={[styles.marketingCardTitle, { color: '#B45309' }]}>🏠 In Your Business</Text>
                                    <Text style={styles.marketingCardText}>Print the QR code and display it at your counter or entrance for easy user registration.</Text>
                                </View>

                                <View style={[styles.marketingCard, { backgroundColor: '#ECFDF5' }]}>
                                    <Text style={[styles.marketingCardTitle, { color: '#047857' }]}>📱 Social Media</Text>
                                    <Text style={styles.marketingCardText}>Share the link on WhatsApp status, Facebook, or Instagram to reach more users.</Text>
                                </View>

                                <View style={[styles.marketingCard, { backgroundColor: '#EFF6FF' }]}>
                                    <Text style={[styles.marketingCardTitle, { color: '#1D4ED8' }]}>💳 Digital Payments</Text>
                                    <Text style={styles.marketingCardText}>Include the link in your UPI payment confirmation SMS to connect users.</Text>
                                </View>
                            </View>

                        </View>
                    ) : (
                        currentShop ? (
                            <TouchableOpacity
                                style={styles.showQrButton}
                                onPress={() => setIsShareExpanded(true)}
                            >
                                <Ionicons name="qr-code-outline" size={20} color="#fff" />
                                <Text style={styles.showQrButtonText}>Show QR Code & Share Options</Text>
                            </TouchableOpacity>
                        ) : (
                            // No Shop Found - Render text directly inside this card since header is already above
                            <View style={styles.noShopMessageContainer}>
                                <Text style={styles.noShopMessageText}>No Business found. Create a business first to generate QR code.</Text>
                            </View>
                        )
                    )}
                </View>
                <View style={styles.settingsCard}>
                    <Text style={styles.settingsTitle}>Account Settings</Text>

                    <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('EditProfile')}>
                        <Ionicons name="person-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                        <Text style={styles.settingText}>Profile Info</Text>
                        <Ionicons name="create-outline" size={18} color="#6B7280" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('CreateShop', { shop: currentShop })}>
                        <Ionicons name="storefront-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                        <Text style={styles.settingText}>Business Info</Text>
                        <Ionicons name="create-outline" size={18} color="#6B7280" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Notifications')}>
                        <Ionicons name="notifications-outline" size={22} color="#4B5563" style={{ marginRight: 12 }} />
                        <Text style={styles.settingText}>Notifications</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('PrivacySecurity')}>
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
                        <Text style={[styles.settingText, styles.logoutTextRed]}>Logout</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerBrand}>ShopMunim</Text>
                    <Text style={styles.footerVersion}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
                    <Text style={styles.footerTagline}>Digital Credit & Payment Ledger</Text>
                    <Text style={styles.footerCopyright}>©2026 DEC24 INNOVATIONS PVT LTD. All Rights Reserved.</Text>

                </View>
                {/* Spacer for bottom nav */}
                <View style={{ height: 100 }} />
            </ScrollView >
        );
    };

    // Handle customer selection for detail view
    const handleCustomerSelect = (customer) => {
        const shopId = user?.shop_id || (shops.length > 0 ? shops[0].id : null);
        navigation.navigate('CustomerDetail', { customer, shopId });
    };

    // Handle service selection for detail view
    const handleServiceSelect = (service) => {
        const shopId = user?.shop_id || (shops.length > 0 ? shops[0].id : null);
        navigation.navigate('ServiceDetail', { customer: service, shopId });
    };



    // Services Tab Content (Filtering customers by type === 'services')
    const renderServicesContent = () => {
        const hasShops = shops.length > 0;

        // Filter for services/staff and by search query
        const filteredServices = customers.filter(customer =>
            customer && 
            (customer.type === 'services' || customer.type === 'staff') && 
            (
                customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                customer.phone?.includes(searchQuery) ||
                customer.nickname?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );

        if (!hasShops) {
            return (
                <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
                    <EmptyStateCard />
                    <View style={{ height: 100 }} />
                </ScrollView>
            );
        }

        if ((loading || loadingCustomers) && !refreshing) {
            return (
                <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabPadding}>
                    <View style={styles.customersHeader}>
                        <Skeleton width="40%" height={28} />
                        <View style={styles.customersHeaderRight}>
                            <Skeleton width={32} height={32} borderRadius={16} />
                            <Skeleton width={80} height={36} borderRadius={6} />
                        </View>
                    </View>
                    <Skeleton width="100%" height={44} borderRadius={8} style={{ marginBottom: 16 }} />
                    <View style={styles.customersList}>
                        {[1, 2, 3].map(i => (
                            <View key={i} style={[styles.customerItem, { flexDirection: 'row', alignItems: 'center' }]}>
                                <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Skeleton width="50%" height={16} style={{ marginBottom: 6 }} />
                                    <Skeleton width="40%" height={14} style={{ marginBottom: 6 }} />
                                </View>
                                <Skeleton width={24} height={24} borderRadius={12} />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            );
        }

        return (
            <ScrollView
                style={styles.tabContent}
                contentContainerStyle={styles.tabPadding}
                // Refresh control is not strictly needed for this filter, but we can reuse the same pull-to-refresh
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={styles.customersHeader}>
                    <Text style={styles.customersTitle}>Services</Text>
                    <View style={styles.customersHeaderRight}>
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{filteredServices.length}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.addButtonBlue}
                            onPress={() => {
                                setNewCustomerName('');
                                setNewCustomerPhone('');
                                setNewCustomerNickname('');
                                setNewCustomerType('services');
                                setShowAddCustomerModal(true);
                            }}
                        >
                            <Ionicons name="briefcase-outline" size={16} color="#fff" />
                            <Text style={styles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search services by name or phone..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Empty State or List */}
                {filteredServices.length === 0 && searchQuery ? (
                    <View style={styles.customersEmptyState}>
                        <Text style={styles.tabEmptyText}>No matching services found</Text>
                    </View>
                ) : filteredServices.length === 0 ? (
                    <View style={styles.customersEmptyState}>
                        <Ionicons name="briefcase" size={48} color="#6366F1" />
                        <Text style={styles.tabEmptyText}>No services yet</Text>
                        <Text style={styles.tabEmptySubtext}>Add your first service provider to get started</Text>
                    </View>
                ) : (
                    <View style={styles.customersList}>
                        {filteredServices.map((service) => (
                            <View key={service.id} style={styles.customerItem}>
                                <View style={[styles.customerAvatar, { backgroundColor: '#EEF2FF' }]}>
                                    <Text style={[styles.customerAvatarText, { color: '#4F46E5' }]}>
                                        {service.name?.charAt(0)?.toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.customerInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.customerName}>
                                            {service.name}
                                            {service.nickname ? ` (${service.nickname})` : ''}
                                        </Text>
                                    </View>
                                    <Text style={styles.customerPhone}>+91 {service.phone}</Text>
                                </View>
                                <View style={styles.customerRightSide}>
                                    <TouchableOpacity
                                        style={styles.arrowButton}
                                        onPress={() => handleServiceSelect(service)}
                                    >
                                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
                {/* Spacer for bottom nav */}
                <View style={{ height: 110 }} />
            </ScrollView>
        );
    };

    // Render active tab content
    const renderContent = () => {
        switch (activeTab) {
            case 'home': return renderHomeContent();
            case 'products': return renderProductsContent();
            case 'customers': return renderCustomersContent();
            case 'transactions': return renderTransactionsContent();
            case 'services': return renderServicesContent();
            case 'account': return renderAccountContent();
            default: return renderHomeContent();
        }
    };

    // Bottom Navigation Tab - Matching reference exactly
    // Bottom Navigation Tab - Matching Admin Panel Style
    // (TabButton removed - using ShopBottomNav component)

    // Reusable Toast Component Helper
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
                                outputRange: [20, 0]
                            })
                        }]
                    }
                ]}
            >
                <View style={styles.toastContent}>
                    <View style={[styles.toastIcon, toastType === 'error' && { backgroundColor: '#EF4444' }]}>
                        <Ionicons name={toastType === 'error' ? "alert-circle" : "checkmark-circle"} size={20} color="#fff" />
                    </View>
                    <Text style={[styles.toastText, typeof toastMessage === 'string' && toastMessage.toLowerCase().includes('network error') && { paddingHorizontal: 10, flex: 1 }]}>{toastMessage}</Text>
                </View>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ShopHeader
                shopName={(shops.find(s => s.id === user?.shop_id) || shops[0])?.name}
                onSwitchError={(msg) => showToast(msg, 'error')}
            />
            <View style={styles.content}>{renderContent()}</View>
            {!isKeyboardVisible && (
                <ShopBottomNav
                    activeTab={activeTab}
                    onTabPress={(tab) => {
                        if (tab !== activeTab) {
                            setCurrentPage(1);
                        }
                        setActiveTab(tab);
                    }}
                />
            )}



            {/* Add Customer Modal */}
            <Modal
                visible={showAddCustomerModal}
                onClose={() => setShowAddCustomerModal(false)}
                title="Add New User"
                toast={toastVisible && showAddCustomerModal ? renderToast() : null}
            >
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>User Name <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Enter user name"
                        placeholderTextColor="#9CA3AF"
                        value={newCustomerName}
                        onChangeText={setNewCustomerName}
                        autoCapitalize="words"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Enter 10-digit phone number"
                        placeholderTextColor="#9CA3AF"
                        value={newCustomerPhone}
                        onChangeText={(text) => setNewCustomerPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
                        keyboardType="numeric"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Type <Text style={styles.required}>*</Text></Text>
                    <View style={styles.typeToggle}>
                        {['customer', 'staff', 'services'].map((t) => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.typeOption, newCustomerType === t && styles.typeOptionActive]}
                                onPress={() => setNewCustomerType(t)}
                            >
                                <Text style={[styles.typeOptionText, newCustomerType === t && styles.typeOptionTextActive]}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nickname (Optional)</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Pappu via Sharma ji"
                        placeholderTextColor="#9CA3AF"
                        value={newCustomerNickname}
                        onChangeText={setNewCustomerNickname}
                        autoCapitalize="words"
                    />
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, addingCustomer && styles.submitButtonDisabled]}
                    onPress={handleAddCustomer}
                    disabled={addingCustomer}
                >
                    {addingCustomer ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Add</Text>
                    )}
                </TouchableOpacity>
            </Modal>

            {/* Add Product Modal */}
            <Modal
                visible={showAddProductModal}
                onClose={() => setShowAddProductModal(false)}
                title={editingProduct ? 'Edit Product' : 'Add New Product'}
                description={editingProduct ? 'Update product details' : 'Add a new product to your shop inventory'}
                toast={toastVisible && showAddProductModal ? renderToast() : null}
            >
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Product Name <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="e.g., Tea, Cigarette, Wafers"
                        placeholderTextColor="#9CA3AF"
                        value={newProductName}
                        onChangeText={setNewProductName}
                        autoCapitalize="words"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Price (₹) <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Enter price"
                        placeholderTextColor="#9CA3AF"
                        value={newProductPrice}
                        onChangeText={(text) => {
                            // Only allow numbers and at most one decimal point
                            const filtered = text.replace(/[^0-9.]/g, '');
                            const parts = filtered.split('.');
                            const finalValue = parts.length > 2
                                ? `${parts[0]}.${parts.slice(1).join('')}`
                                : filtered;
                            setNewProductPrice(finalValue);
                        }}
                        keyboardType="numeric"
                    />
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, addingProduct && styles.submitButtonDisabled]}
                    onPress={handleAddProduct}
                    disabled={addingProduct}
                >
                    {addingProduct ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>{editingProduct ? 'Update Product' : 'Add Product'}</Text>
                    )}
                </TouchableOpacity>
            </Modal>


            {/* Add Transaction Modal */}
            <AddTransactionModal
                visible={showAddTransactionModal}
                onClose={() => setShowAddTransactionModal(false)}
                shopId={(() => {
                    const sid = user?.shop_id || (shops.length > 0 ? shops[0].id : null);
                    return sid;
                })()}
                shopName={(() => {
                    const sid = user?.shop_id || (shops.length > 0 ? shops[0].id : null);
                    const currentShop = shops.find(s => s.id === sid);
                    return currentShop?.name || 'our store';
                })()}
                onSuccess={() => {
                    const shopId = user?.shop_id || (shops.length > 0 ? shops[0].id : null);
                    if (shopId) {
                        loadDashboardStats(shopId);
                        if (activeTab === 'customers') loadCustomers(shopId);
                        showToast('Transaction added successfully');
                    }
                }}
            />

            {/* Custom Toast Notification - Global */}
            {toastVisible && !showAddCustomerModal && !showAddProductModal && renderToast()}
        </SafeAreaView >
    );
};




const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    content: { flex: 1, overflow: 'hidden' },


    // Header
    header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logo: { fontSize: 20, fontWeight: 'bold', color: '#3B82F6' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    roleSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5, gap: 6 },
    roleSelectorText: { fontSize: 14, color: '#333' },
    headerLogout: { fontSize: 14, color: '#666' },
    headerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    welcomeText: { fontSize: 14, color: '#666' },
    userName: { fontWeight: 'bold', color: '#333' },
    phoneContainer: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
    phoneText: { fontSize: 12, color: '#000' },

    // Role Dropdown
    roleDropdown: {
        position: 'absolute',
        top: 45,
        right: 60,
        backgroundColor: '#fff',
        borderRadius: 8,
        elevation: 5,
        padding: 8,
        zIndex: 100,
        minWidth: 180,
    },
    roleOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
    roleOptionActive: { backgroundColor: '#F0F9FF', borderRadius: 6 },
    roleOptionText: { flex: 1, fontSize: 14, color: '#333' },

    // Tab Content
    tabContent: { flex: 1 },
    tabContentContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    tabPadding: { padding: 16 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Dashboard Styles
    dashboardContainer: { padding: 16, flexGrow: 1 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    statCard: {
        width: STAT_CARD_WIDTH,
        minHeight: 120,
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    statNumber: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginVertical: 4 },
    statLabel: { fontSize: 12, color: '#6B7280' },
    statLabel2: { fontSize: 12, color: '#6B7280', marginTop: 6, maxWidth: 100, textAlign: 'center' },
    rupeeCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rupeeIcon: { fontSize: 18, fontWeight: 'bold', color: '#EF4444' },
    transactionsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: 8,
        gap: 4,
    },
    transactionsButtonText: { color: '#fff', fontSize: 12, fontWeight: '500' },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 12 },
    quickActionsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    quickActionBlue: {
        flex: 1,
        flexDirection: 'column', // Stacked
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB', // Blue-600
        paddingVertical: 16,
        borderRadius: 12,
        gap: 6,
    },
    quickActionGreen: {
        flex: 1,
        flexDirection: 'column', // Stacked
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981', // Emerald-500
        paddingVertical: 16,
        borderRadius: 12,
        gap: 6,
    },
    quickActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    recentActivityCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    recentActivityTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
    recentActivityEmpty: { fontSize: 14, color: '#9CA3AF' },

    // Products Tab Styles
    tabHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    tabHeaderLeft: { flex: 1, marginRight: 12 },
    tabHeaderTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
    tabHeaderSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2, lineHeight: 18 },
    addButtonBlue: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 6,
        gap: 6,
    },
    addButtonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
    tabEmptyState: { alignItems: 'center', marginTop: 60 },
    tabEmptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
    tabEmptySubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },

    // Products Card (combined header + empty state)
    productsCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    productsCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    productsEmptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },

    // Customers Tab Styles
    customersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    customersTitle: { fontSize: 20, fontWeight: '600', color: '#111827' },
    customersHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    countBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    countBadgeText: { fontSize: 12, fontWeight: '500', color: '#374151' },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 20,
        gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, color: '#111827' },
    customersEmptyState: { alignItems: 'center', marginTop: 60 },

    // Transactions Tab Styles
    transactionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    transactionsTitle: { fontSize: 20, fontWeight: '600', color: '#111827' },
    transactionsEmptyState: { alignItems: 'center', marginTop: 60 },
    moneyBagEmoji: { fontSize: 48 },

    // Empty State Card - Matching reference
    emptyCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 8, textAlign: 'center' },
    emptyDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
    createShopButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    createShopText: { color: '#fff', fontSize: 16, fontWeight: '600' },    // Account Tab Styles
    accountScrollContent: { flexGrow: 1, padding: 16 },

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
        fontSize: 10,
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

    settingText: { flex: 1, fontSize: 16, color: '#374151', fontWeight: '500' },
    logoutTextRed: { color: '#EF4444' },
    logoutBtn: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 20,
    },



    // Bottom Navigation - Matching reference exactly
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
        elevation: 8,
        height: 65,
        zIndex: 1000,
    },
    navItemWrapper: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        gap: 4,
    },
    navItemActiveGradient: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        gap: 4,
    },
    navText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#6B7280',
    },
    navTextActive: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#3B82F6',
    },

    // Create Shop Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#111827',
        backgroundColor: '#fff',
    },
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    dropdownText: {
        fontSize: 14,
        color: '#111827',
    },
    placeholderText: {
        color: '#9CA3AF',
    },
    dropdownList: {
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
    dropdownScroll: {
        maxHeight: 200,
    },
    dropdownItem: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#374151',
    },
    createButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    createButtonDisabled: {
        opacity: 0.7,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        position: 'relative',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    modalClose: {
        position: 'absolute',
        right: 0,
        padding: 4,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 8,
    },
    typeToggle: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 4,
        marginBottom: 8,
    },
    typeOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
    },
    typeOptionActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    typeOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    typeOptionTextActive: {
        color: '#2563EB',
        fontWeight: '600',
    },
    required: {
        color: '#EF4444',
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
        backgroundColor: '#fff',
    },
    dropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    dropdownText: {
        fontSize: 16,
        color: '#111827',
    },
    placeholder: {
        fontSize: 16,
        color: '#9CA3AF',
    },
    categoryList: {
        marginBottom: 16,
        marginTop: -8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    categoryItem: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    categoryItemText: {
        fontSize: 15,
        color: '#374151',
    },
    submitButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },



    // Share Card Styles
    shareCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        ...shadows.sm,
        overflow: 'hidden',
    },
    shareHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    shareIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    shareTitleContainer: {
        flex: 1,
    },
    shareTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    shareSubtitle: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },
    showQrButton: {
        flexDirection: 'row',
        backgroundColor: '#6D28D9', // Deep Purple
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 4,
    },
    showQrButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    // Expanded State Styles
    shareExpandedContent: {
        marginTop: 8,
    },
    shareBlueHeader: {
        backgroundColor: '#6D28D9',
        borderRadius: 8,
        marginBottom: 16,
        overflow: 'hidden',
    },
    collapseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 6,
    },
    collapseButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    qrSection: {
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 16,
        marginBottom: 16,
    },
    qrLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
        alignSelf: 'flex-start',
    },
    qrContainer: {
        padding: 16,
        backgroundColor: '#fff',
    },
    qrActionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        width: '100%',
    },
    qrActionButton: {
        flex: 1,
        // flexDirection: 'row', // Removed to stack vertically
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        paddingVertical: 10, // Increased padding
        gap: 6,
    },
    qrActionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },
    qrFooterText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 16,
    },

    linkSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 16,
        marginBottom: 16,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    sectionSubHeader: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 12,
    },
    linkBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 12,
        gap: 8,
    },
    linkText: {
        flex: 1,
        fontSize: 13,
        color: '#4B5563',
    },
    copyLinkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        paddingVertical: 10,
        gap: 6,
        marginBottom: 12,
    },
    copyLinkText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },
    shareButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    whatsappButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#22C55E',
        borderRadius: 6,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    whatsappButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    nativeShareButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    nativeShareText: {
        color: '#374151',
        fontSize: 13,
        fontWeight: '500',
    },
    infoBoxBlue: {
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    infoBoxTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E40AF',
        marginBottom: 8,
    },
    infoBoxItem: {
        fontSize: 12,
        color: '#1E3A8A',
        marginBottom: 4,
    },

    marketingSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 16,
    },
    marketingTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    marketingCard: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
    },
    marketingCardTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    marketingCardText: {
        fontSize: 12,
        color: '#4B5563',
        lineHeight: 18,
    },
    marketingCardText: {
        fontSize: 12,
        color: '#4B5563',
        lineHeight: 18,
    },

    shopDetailsCard: {
        // Removed as it is now inside shopInfoCard
    },

    // New Card Styles
    shopInfoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    shopDetailsContent: {
        paddingLeft: 4,
    },

    qrCodeCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        alignItems: 'center', // Center content in QR card
    },
    qrCardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
        alignSelf: 'flex-start',
    },
    qrCardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
        alignSelf: 'flex-start',
        lineHeight: 20,
    },
    qrActionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20, // Space from QR code
        marginBottom: 8, // Space before footer text
        width: '100%',
    },
    qrFooter: {
        flexDirection: 'row',
        alignItems: 'center', // Center vertically
        justifyContent: 'center', // Center horizontally
        marginTop: 8,
        marginBottom: 8,
        gap: 6,
        paddingHorizontal: 20,
    },
    qrFooterEmoji: {
        fontSize: 14,
        marginBottom: 20,
    },
    qrFooterText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        flexShrink: 1, // Ensure text wraps if needed
        lineHeight: 18,
    },

    // Updated existing styles
    shopNameLarge: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },

    // No Shop Card Styles
    noShopCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    noShopHeader: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    noShopIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#F3F4F6', // Light gray/purple bg
        alignItems: 'center',
        justifyContent: 'center',
    },
    noShopHeaderTextContainer: {
        flex: 1,
    },
    noShopTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    noShopSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        maxWidth: '95%',
    },
    noShopMessageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    noShopMessageText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 8,
    },

    // Restored Styles for Active Shop Card
    locationCodeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        width: '100%',
    },
    shopLocationText: {
        fontSize: 15,
        color: '#6B7280',
        flex: 1,
        marginRight: 8,
    },
    categoryBadgeSmall: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignSelf: 'flex-start',
    },
    categoryBadgeTextSmall: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
    shopCodeBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    shopCodeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D4ED8',
    },

    // Customer List Styles
    customersList: {
        marginTop: 6,
        gap: 6,
    },
    customerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 10,
    },


    customerAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    customerAvatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#3B82F6',
    },
    customerInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    customerName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    customerPhone: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '400',
    },
    customerBalance: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    customerRightSide: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 8,
    },
    statusBadgeClear: {
        backgroundColor: '#111827',
    },
    statusBadgeAdvance: {
        backgroundColor: '#10B981',
    },
    statusBadgeDue: {
        backgroundColor: '#EF4444',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statusBadgeTextClear: {
        color: '#FFF',
    },
    statusBadgeTextAdvance: {
        color: '#FFF',
    },
    statusBadgeTextDue: {
        color: '#FFF',
    },
    balanceAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    arrowButton: {
        backgroundColor: '#4F83F5', // Similar blue to image
        width: 28,
        height: 28,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12, // Matching other elements
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8, // Explicit spacing
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    productsHeaderCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 16,
    },
    productsEmptyContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 40,
        alignItems: 'center',
    },
    productsList: {
        padding: 16,
        gap: 12,
    },
    productItem: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    productInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    productName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
    },
    priceBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    priceText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    productActionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButtonOutline: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    actionButtonTextOutline: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    actionButtonRed: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#EF4444',
    },
    actionButtonTextRed: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '500',
    },


    // Transaction Card Styles
    transactionsList: {
        marginTop: 6,
        gap: 12,
        paddingBottom: 20,
    },
    transactionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    tCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    tCardName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    tCardDate: {
        fontSize: 12,
        color: '#6B7280',
    },
    tCardRight: {
        alignItems: 'flex-end',
    },
    tCardAmount: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    tCardBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    tCardBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    tCardItems: {
        backgroundColor: '#F3F4F6', // gray-100 (Darker than F9FAFB)
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    tCardLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 2,
    },
    tCardItemText: {
        fontSize: 13,
        color: '#6B7280',
    },
    tCardNote: {
        backgroundColor: '#FFFBEB', // amber-50
        borderLeftWidth: 3,
        borderLeftColor: '#FCD34D', // amber-300
        padding: 10,
        borderRadius: 4,
    },
    tCardNoteText: {
        fontSize: 13,
        color: '#4B5563',
        fontWeight: '400',
    },
    // Customer Detail Styles
    customerDetailBackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    customerDetailBackBtn: {
        padding: 4,
        marginRight: 12,
    },
    customerDetailTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    customerDetailSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    customerDetailCard: {
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
    customerDetailMainCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    customerDetailInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    customerDetailName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    customerDetailPhone: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    customerDetailBalance: {
        fontSize: 20,
        fontWeight: '700',
    },
    customerDetailBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginTop: 4,
    },
    customerDetailBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    customerDetailAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB',
        padding: 14,
        borderRadius: 10,
        marginBottom: 8,
    },
    customerDetailAddBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
        marginLeft: 6,
    },
    customerDetailUpiBtn: {
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
    customerDetailUpiBtnText: {
        color: '#374151',
        fontWeight: '500',
        fontSize: 14,
        marginLeft: 6,
    },
    customerDetailPaymentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F97316',
        padding: 14,
        borderRadius: 10,
        marginBottom: 16,
    },
    customerDetailPaymentBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
        marginLeft: 6,
    },
    customerDetailSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    customerDetailTxHistoryCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    customerDetailSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    customerDetailSectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginLeft: 6,
    },
    customerDetailStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    customerDetailStatBox: {
        width: '48%',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    customerDetailStatValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    customerDetailStatLabel: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
        textAlign: 'center',
    },
    customerDetailTxCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    customerDetailTxBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
    },
    customerDetailDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: -5,
        alignSelf: 'flex-start',
    },
    customerDetailItemsBox: {
        backgroundColor: '#F9FAFB',
        padding: 14,
        borderRadius: 10,
        marginTop: 15,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    customerDetailNetRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
    },
    customerDetailNetLabel: {
        fontSize: 13,
        color: '#374151',
        fontWeight: '500',
    },
    customerDetailNetValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    customerDetailFilterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    customerDetailPdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 6,
        backgroundColor: '#FEF2F2',
    },
    customerDetailExcelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#86EFAC',
        borderRadius: 6,
        backgroundColor: '#F0FDF4',
    },
    customerDetailFilterLabel: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
        marginBottom: 4,
    },
    customerDetailDateInput: {
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
    customerDetailTypeDropdown: {
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
    customerDetailDropdownOptions: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        marginTop: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 100,
    },
    customerDetailDropdownOption: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    customerDetailDropdownOptionActive: {
        backgroundColor: '#EFF6FF',
    },
    customerDetailPaymentNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        padding: 8,
        borderRadius: 6,
        marginTop: 10,
    },
    customerDetailNoteBox: {
        flexDirection: 'row',
        backgroundColor: '#FFFBEB',
        borderLeftWidth: 3,
        borderLeftColor: '#FCD34D',
        padding: 10,
        borderRadius: 4,
        marginTop: 10,
    },
    customerDetailNoteLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#92400E',
    },
    customerDetailNoteText: {
        fontSize: 13,
        color: '#4B5563',
        flex: 1,
    },
    customerDetailItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    customerDetailQtyBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
    },
    customerDetailItemsTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 10,
        marginTop: 4,
    },

    // Footer Styles (Local Implementation)
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

    // Toast Styles
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
    // WhatsApp Verification Styles
    phoneInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    whatsappVerifyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCF8C6',
        paddingHorizontal: 12,
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    whatsappVerifyText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#075E54',
        marginLeft: 4,
    },
});

export default ShopOwnerDashboardScreen;
// Create Shop Screen - Modal style centered popup
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Dimensions,
    Keyboard,
    Animated,
} from 'react-native';
import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { shopAPI, locationAPI } from '../../api';

const SHOP_CATEGORIES = [
    'Grocery / Kirana',
    'Restaurant / Cafe / Food',
    'Clothing & Apparel',
    'Mobile & Electronics',
    'Medical & Pharmacy',
    'Hardware & Sanitary',
    'Footwear',
    'Salon & Beauty Parlour',
    'Jewellery',
    'Stationery & Book Store',
    'Dairy & Sweets',
    'Automobile / Garage',
    'Other'
];

const CreateShopScreen = ({ navigation, route }) => {
    const editingShop = route.params?.shop;
    const [shopName, setShopName] = useState(editingShop?.name || '');
    const [shopCategory, setShopCategory] = useState(editingShop?.category || '');
    const [pincode, setPincode] = useState(editingShop?.pincode || '');
    const [city, setCity] = useState(editingShop?.city || '');
    const [state, setState] = useState(editingShop?.state || '');
    const [country, setCountry] = useState(editingShop?.country || '');
    const [area, setArea] = useState(editingShop?.area || '');
    const [upiId, setUpiId] = useState(editingShop?.upi_id || '');
    const [availableAreas, setAvailableAreas] = useState([]);
    const [isLoadingPincode, setIsLoadingPincode] = useState(false);

    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [showAreaDropdown, setShowAreaDropdown] = useState(false);
    const [creating, setCreating] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef(null);

    const showToast = (message) => {
        Keyboard.dismiss();
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

    // If editing, availableAreas might need to be fetched or just set area as text
    // For now, if we have area, we can just set it. We won't re-fetch postal APIs on load unless user changes pincode.

    React.useEffect(() => {
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

    const fetchLocationDetails = async (pin, preserveArea = false) => {
        if (pin.length !== 6) return;
        setIsLoadingPincode(true);
        try {
            // Fetch from our own python backend to bypass MSG91 Network Interceptors
            const response = await locationAPI.getByPincode(pin);
            const data = response.data;

            if (data && data[0].Status === 'Success') {
                const postOffice = data[0].PostOffice;
                const office = postOffice[0];

                setCity(office.District);
                setState(office.State);
                setCountry(office.Country);

                const areas = postOffice.map(po => po.Name);
                setAvailableAreas(areas);
                if (areas.length > 0 && !preserveArea) {
                    setArea(areas[0]);
                }
            } else {
                if (!preserveArea) showToast('Invalid Pincode');
                if (!preserveArea) {
                    setCity('');
                    setState('');
                    setCountry('');
                    setAvailableAreas([]);
                    setArea('');
                }
            }
        } catch (error) {
            console.error('Error fetching pincode details:', error);
            if (!preserveArea) showToast('Failed to fetch location details');
        } finally {
            setIsLoadingPincode(false);
        }
    };

    React.useEffect(() => {
        if (editingShop?.pincode && String(editingShop.pincode).length === 6) {
            fetchLocationDetails(String(editingShop.pincode), true);
        }
    }, []);

    const handlePincodeChange = (text) => {
        // Only allow numbers
        const numericText = text.replace(/[^0-9]/g, '');
        setPincode(numericText);

        if (numericText.length === 6) {
            fetchLocationDetails(numericText);
        } else if (numericText.length < 6 && pincode.length === 6) {
            // Only clear if we actually had a valid pincode before
            setCity('');
            setState('');
            setCountry('');
            setAvailableAreas([]);
            setArea('');
        }
    };

    const handleCreate = async () => {
        Keyboard.dismiss();
        if (!shopName.trim()) {
            showToast('Please enter shop name');
            return;
        }
        if (!shopCategory) {
            showToast('Please select a category');
            return;
        }
        if (!pincode || pincode.length !== 6) {
            showToast('Please enter a valid 6-digit pincode');
            return;
        }
        if (!area) {
            showToast('Please select an area');
            return;
        }

        // UPI ID Validation (Optional but must be correct if provided)
        if (upiId.trim()) {
            const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
            if (!upiRegex.test(upiId.trim())) {
                showToast('UPI ID not correct');
                return;
            }
        }

        setCreating(true);
        try {
            const shopData = {
                name: shopName.trim(),
                category: shopCategory,
                pincode: pincode,
                city: city,
                state: state,
                country: country,
                area: area,
                location: `${area}, ${city}, ${state}, ${pincode}`, // For backward compatibility
                upi_id: upiId.trim()
            };

            if (editingShop) {
                await shopAPI.update(editingShop.id, shopData);
                navigation.navigate('ShopOwnerDashboard', {
                    tab: 'account',
                    successMessage: 'Shop updated successfully!',
                    refresh: true
                });
            } else {
                await shopAPI.create(shopData);
                navigation.navigate('ShopOwnerDashboard', {
                    successMessage: 'Shop created successfully!',
                    refresh: true
                });
            }
        } catch (error) {
            console.error('Shop save error:', error);
            const msg = error.response?.data?.detail || 'Failed to save shop';
            showToast(msg);
        } finally {
            setCreating(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <TouchableWithoutFeedback onPress={() => { setShowCategoryDropdown(false); setShowAreaDropdown(false); }}>
                        <View style={styles.modalContent}>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{editingShop ? 'Edit Business' : 'Create New Business'}</Text>
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                                    <Ionicons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                overScrollMode="never"
                                contentContainerStyle={{ paddingBottom: keyboardVisible ? 40 : 20 }}
                            >
                                <Pressable style={{ flex: 1 }} onPress={() => { setShowCategoryDropdown(false); setShowAreaDropdown(false); }}>
                                    {/* Shop Name */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Business Name <Text style={styles.required}>*</Text></Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Enter business name"
                                            placeholderTextColor="#9CA3AF"
                                            value={shopName}
                                            onChangeText={setShopName}
                                            onFocus={() => { setShowCategoryDropdown(false); setShowAreaDropdown(false); }}
                                            autoCapitalize="words"
                                        />
                                    </View>

                                    {/* Category */}
                                    <View style={[styles.inputGroup, { zIndex: 2000 }]}>
                                        <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
                                        <TouchableOpacity
                                            style={styles.dropdown}
                                            onPress={() => {
                                                setShowCategoryDropdown(!showCategoryDropdown);
                                                setShowAreaDropdown(false);
                                            }}
                                        >
                                            <Text style={shopCategory ? styles.dropdownText : styles.placeholder}>
                                                {shopCategory || 'Select category'}
                                            </Text>
                                            <Ionicons
                                                name={showCategoryDropdown ? "chevron-up" : "chevron-down"}
                                                size={20}
                                                color="#9CA3AF"
                                            />
                                        </TouchableOpacity>

                                        {showCategoryDropdown && (
                                            <View style={styles.categoryList}>
                                                <ScrollView 
                                                    style={{ maxHeight: 250 }} 
                                                    nestedScrollEnabled={true} 
                                                    keyboardShouldPersistTaps="handled"
                                                    contentContainerStyle={{ paddingBottom: 10 }}
                                                >
                                                    {SHOP_CATEGORIES.map((cat, idx) => (
                                                        <TouchableOpacity
                                                            key={idx}
                                                            style={styles.categoryItem}
                                                            onPress={() => {
                                                                setShopCategory(cat);
                                                                setShowCategoryDropdown(false);
                                                            }}
                                                        >
                                                            <Text style={styles.categoryItemText}>{cat}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>

                                    {/* UPI ID */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>UPI ID (For Payments)</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="e.g. businessname@okicici"
                                            placeholderTextColor="#9CA3AF"
                                            value={upiId}
                                            onChangeText={setUpiId}
                                            onFocus={() => { setShowCategoryDropdown(false); setShowAreaDropdown(false); }}
                                            autoCapitalize="none"
                                        />
                                        <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                                            This will be used to generate payment links for users.
                                        </Text>
                                    </View>

                                    {/* Pincode */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Pincode <Text style={styles.required}>*</Text></Text>
                                        <View style={styles.pincodeContainer}>
                                            <TextInput
                                                style={[styles.textInput, { flex: 1 }]}
                                                placeholder="Enter 6-digit Pincode"
                                                placeholderTextColor="#9CA3AF"
                                                value={pincode}
                                                onChangeText={handlePincodeChange}
                                                onFocus={() => { setShowCategoryDropdown(false); setShowAreaDropdown(false); }}
                                                keyboardType="number-pad"
                                                maxLength={6}
                                            />
                                            {isLoadingPincode && (
                                                <ActivityIndicator style={styles.pincodeLoader} size="small" color="#3B82F6" />
                                            )}
                                        </View>
                                    </View>

                                    {/* Area Field */}
                                    <View style={[styles.inputGroup, { zIndex: 1000 }]}>
                                        <Text style={styles.label}>Area <Text style={styles.required}>*</Text></Text>

                                        {isLoadingPincode ? (
                                            <View style={[styles.dropdown, styles.readOnlyInput]}>
                                                <Text style={styles.placeholder}>Fetching areas...</Text>
                                                <ActivityIndicator size="small" color="#3B82F6" />
                                            </View>
                                        ) : availableAreas.length > 0 ? (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.dropdown}
                                                    onPress={() => {
                                                        if (pincode.length === 6) {
                                                            setShowAreaDropdown(!showAreaDropdown);
                                                            setShowCategoryDropdown(false);
                                                        }
                                                    }}
                                                >
                                                    <Text style={area ? styles.dropdownText : styles.placeholder}>
                                                        {area || 'Select Area'}
                                                    </Text>
                                                    <Ionicons
                                                        name={showAreaDropdown ? "chevron-up" : "chevron-down"}
                                                        size={20}
                                                        color="#9CA3AF"
                                                    />
                                                </TouchableOpacity>

                                                {showAreaDropdown && (
                                                    <View style={styles.categoryList}>
                                                        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled={true}>
                                                            {availableAreas.map((item, idx) => (
                                                                <TouchableOpacity
                                                                    key={idx}
                                                                    style={styles.categoryItem}
                                                                    onPress={() => {
                                                                        setArea(item);
                                                                        setShowAreaDropdown(false);
                                                                    }}
                                                                >
                                                                    <Text style={styles.categoryItemText}>{item}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </ScrollView>
                                                    </View>
                                                )}
                                            </>
                                        ) : (
                                            <TextInput
                                                style={[styles.textInput, styles.readOnlyInput]}
                                                placeholder={pincode.length === 6 ? "Invalid Pincode" : "Enter pincode first"}
                                                placeholderTextColor={pincode.length === 6 ? "#EF4444" : "#9CA3AF"}
                                                value={area}
                                                onChangeText={setArea}
                                                onFocus={() => { setShowCategoryDropdown(false); setShowAreaDropdown(false); }}
                                                autoCapitalize="words"
                                                editable={false}
                                            />
                                        )}
                                    </View>

                                    {/* Auto-filled Fields */}
                                    <View style={styles.row}>
                                        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                            <Text style={styles.label}>City</Text>
                                            <TextInput
                                                style={[styles.textInput, styles.readOnlyInput]}
                                                value={isLoadingPincode ? '' : city}
                                                placeholder={isLoadingPincode ? "Fetching..." : "City"}
                                                placeholderTextColor="#9CA3AF"
                                                editable={false}
                                            />
                                        </View>
                                        <View style={[styles.inputGroup, { flex: 1 }]}>
                                            <Text style={styles.label}>State</Text>
                                            <TextInput
                                                style={[styles.textInput, styles.readOnlyInput]}
                                                value={isLoadingPincode ? '' : state}
                                                placeholder={isLoadingPincode ? "Fetching..." : "State"}
                                                placeholderTextColor="#9CA3AF"
                                                editable={false}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Country</Text>
                                        <TextInput
                                            style={[styles.textInput, styles.readOnlyInput]}
                                            value={isLoadingPincode ? '' : country}
                                            placeholder={isLoadingPincode ? "Fetching..." : "Country"}
                                            placeholderTextColor="#9CA3AF"
                                            editable={false}
                                        />
                                    </View>

                                    {/* Create Button */}
                                    <TouchableOpacity
                                        style={[styles.button, creating && styles.buttonDisabled]}
                                        onPress={handleCreate}
                                        disabled={creating}
                                    >
                                        {creating ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.buttonText}>{editingShop ? 'Update Business' : 'Create Business'}</Text>
                                        )}
                                    </TouchableOpacity>
                                </Pressable>
                            </ScrollView>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>

                {/* Custom Toast Notification */}
                {toastVisible && (
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
                            <View style={styles.toastIcon}>
                                <Ionicons name="information-circle" size={18} color="#fff" />
                            </View>
                            <Text style={styles.toastText}>{toastMessage}</Text>
                        </View>
                    </Animated.View>
                )}
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: Dimensions.get('window').height * 0.1, // Start 10% from top
    },
    keyboardView: {
        width: '100%',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        width: '90%',
        maxHeight: Dimensions.get('window').height * 0.8,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        position: 'relative',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    closeButton: {
        position: 'absolute',
        right: 0,
        padding: 4,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 8,
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
        marginTop: 4,
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
    button: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    pincodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pincodeLoader: {
        marginLeft: 10,
    },
    readOnlyInput: {
        backgroundColor: '#F3F4F6',
        color: '#6B7280',
    },
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

export default CreateShopScreen;

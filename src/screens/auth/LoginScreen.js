// Login Screen with Phone + OTP authentication
import React, { useState, useEffect, useCallback } from 'react';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import {
    View,
    Text,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Keyboard,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../api';
import { colors, spacing, borderRadius } from '../../theme';
import { isValidPhone, isValidOTP } from '../../utils/helpers';
import { useRef } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getOtpBlockInfo = async (phone) => {
    try {
        const str = await AsyncStorage.getItem("otpBlockInfo_" + phone);
        if (!str) return {};
        return JSON.parse(str);
    } catch {
        return {};
    }
};

const setOtpBlockInfo = async (phone, info) => {
    try {
        await AsyncStorage.setItem("otpBlockInfo_" + phone, JSON.stringify(info));
    } catch (e) {
        console.error("Failed to save block info", e);
    }
};

const LoginScreen = ({ navigation }) => {
    const { login, logoutToast, clearLogoutToast } = useAuth();
    const [step, setStep] = useState('phone');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [otp, setOtp] = useState('');
    const [reqId, setReqId] = useState(null);
    const [loading, setLoading] = useState(false);

    // OTP Blocking / Timer State
    const [counter, setCounter] = useState(0);
    const [resendBlocked, setResendBlocked] = useState(false);
    const [resendCount, setResendCount] = useState(0);
    const [blockedUntil, setBlockedUntil] = useState(null);
    const timerRef = useRef(null);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [toastType, setToastType] = useState('success');
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef(null);

    // Initialize block info on mount/phone change
    useFocusEffect(
        useCallback(() => {
            const checkBlockInfo = async () => {
                if (!phone || phone.length < 10) return;
                const info = await getOtpBlockInfo(phone);
                setResendCount(info.resendCount || 0);
                setBlockedUntil(info.blockedUntil || null);
                if (info.blockedUntil && Date.now() < info.blockedUntil) {
                    setResendBlocked(true);
                } else {
                    setResendBlocked(false);
                }
            };
            checkBlockInfo();
        }, [phone])
    );

    // Timer for resend OTP
    useEffect(() => {
        if (resendBlocked || step !== 'otp') return;
        timerRef.current = setInterval(() => {
            setCounter((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [resendCount, resendBlocked, step]);

    // Handle block for 30min after attempts
    useEffect(() => {
        if (!blockedUntil) return;
        if (Date.now() < blockedUntil) {
            setResendBlocked(true);
            const timeout = setTimeout(() => {
                setResendBlocked(false);
                setBlockedUntil(null);
                setOtpBlockInfo(phone, {
                    resendCount: 0,
                    lastResend: null,
                    blockedUntil: null,
                });
            }, blockedUntil - Date.now());
            return () => clearTimeout(timeout);
        } else {
            setResendBlocked(false);
            setBlockedUntil(null);
        }
    }, [blockedUntil, phone]);

    const showToast = (message, type = 'success') => {
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

    useFocusEffect(
        useCallback(() => {
            if (logoutToast) {
                showToast('Logged out successfully');
                clearLogoutToast();
            }
        }, [logoutToast])
    );

    const handleSendOTP = async () => {
        Keyboard.dismiss();
        if (!isValidPhone(phone)) {
            showToast('Please Enter a Valid Phone Number');
            return;
        }

        if (resendBlocked) {
            const timeLeft = blockedUntil ? Math.ceil((blockedUntil - Date.now()) / 60000) : 30;
            showToast(`Too many attempts. Blocked for ${timeLeft} minutes.`, 'error');
            return;
        }

        setLoading(true);
        try {
            // Check if user exists first
            const checkResponse = await authAPI.checkPhone(phone);
            if (!checkResponse.data.exists) {
                showToast('This number is not registered. Please sign up.', 'error');
                return;
            }

            console.log('Sending OTP via SDK to:', phone);
            // Format phone to MSG91 format (usually requires country code)
            const mobile = phone.length === 10 ? `91${phone}` : phone.replace('+', '');
            const data = { identifier: mobile };

            const response = await OTPWidget.sendOTP(data);
            console.log('OTP SDK Response:', response);

            if (response?.type === 'error') {
                showToast(response?.message || 'Failed to send OTP', 'error');
                return;
            }

            // MSG91 usually returns the request ID in `message` or `reqId` field
            const returnedReqId = response?.message || response?.reqId;
            setReqId(returnedReqId);

            showToast('OTP Sent Successfully');

            // Handle fresh send vs resend
            const info = await getOtpBlockInfo(phone) || {};
            // If we are already on 'otp' step, it's a resend
            let currentCount = step === 'otp' ? (info.resendCount || 0) + 1 : 0;

            if (currentCount >= 3) {
                const blockTime = Date.now() + 30 * 60 * 1000;
                await setOtpBlockInfo(phone, {
                    ...info,
                    resendCount: currentCount,
                    lastResend: Date.now(),
                    blockedUntil: blockTime,
                });
                setResendBlocked(true);
                setBlockedUntil(blockTime);
                showToast("Maximum resend attempts reached. Try again after 30 minutes.", "error");
            } else {
                await setOtpBlockInfo(phone, {
                    ...info,
                    resendCount: currentCount,
                    lastResend: Date.now(),
                    blockedUntil: null,
                });
                setResendCount(currentCount);
                setCounter(30); // Start 30s timer
            }

            setStep('otp');
        } catch (error) {
            console.log('OTP Error:', error);
            const errorDetail = error?.message || 'OTP Not Sent';
            showToast(errorDetail, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        Keyboard.dismiss();
        if (!isValidOTP(otp)) {
            showToast('Please enter a valid OTP');
            return;
        }

        setLoading(true);
        try {
            if (!reqId) {
                showToast('Session expired, please resend OTP', 'error');
                return;
            }
            const body = { reqId: reqId, otp: otp };
            const response = await OTPWidget.verifyOTP(body);
            console.log('OTP Verify SDK Response:', response);

            if (response?.type === 'error' && !response?.success) {
                showToast(response?.message || 'Invalid OTP', 'error');
                return;
            }

            // Clear blocks on success
            await setOtpBlockInfo(phone, {});

            // Now that MSG91 confirmed it, tell the backend to log the user in!
            const backendResponse = await authAPI.verifySDK(phone, name || undefined, true);

            await login(backendResponse.data.token, backendResponse.data.user);
        } catch (error) {
            console.log('Verify OTP SDK Error:', error);
            showToast(error?.message || error?.response?.data?.detail || 'Invalid OTP', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneChange = (text) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 10);
        setPhone(cleaned);
    };

    const handleOTPChange = (text) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 6);
        setOtp(cleaned);
    };

    // Gradient-like Text using colored spans
    const GradientTitle = () => (
        <View style={styles.titleContainer}>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#3B82F6' }}>Sh</Text>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#6366F1' }}>op</Text>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#8B5CF6' }}>Mu</Text>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#A855F7' }}>ni</Text>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#EC4899' }}>m</Text>
        </View>
    );

    return (
        <LinearGradient
            colors={['#E0E7FF', '#EDE9FE', '#FCE7F3']}
            style={styles.container}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo & Title */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={['#3B82F6', '#8B5CF6']}
                            style={styles.logoContainer}
                        >
                            <Ionicons name="layers-outline" size={28} color="#fff" />
                        </LinearGradient>
                        <GradientTitle />
                        <Text style={styles.subtitle}>Digital Credit & Payment Ledger</Text>
                    </View>

                    {/* Auth Card */}
                    <Card style={styles.card}>
                        <Text style={styles.cardTitle}>Welcome</Text>
                        <Text style={styles.cardDescription}>
                            {step === 'phone'
                                ? 'Enter your phone number to get started'
                                : 'Enter the OTP sent to your phone'}
                        </Text>

                        {step === 'phone' ? (
                            <View style={styles.form}>
                                <Input
                                    label="Name"
                                    placeholder="Enter your name"
                                    value={name}
                                    onChangeText={setName}
                                    style={styles.input}
                                />
                                <Input
                                    label="Phone Number"
                                    placeholder="Enter 10-digit number"
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    keyboardType="phone-pad"
                                    prefix="+91"
                                    required
                                    style={styles.input}
                                />
                                <Button
                                    title="Send OTP"
                                    onPress={handleSendOTP}
                                    loading={loading}
                                    disabled={!phone}
                                    size="md"
                                    icon={<Ionicons name="send" size={16} color="#fff" />}
                                    style={styles.button}
                                />
                            </View>
                        ) : (
                            <View style={styles.form}>
                                <Input
                                    label="Enter OTP"
                                    placeholder="Enter 4-digit OTP"
                                    value={otp}
                                    onChangeText={handleOTPChange}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    required
                                    style={styles.input}
                                />
                                <Button
                                    title="Verify & Continue"
                                    onPress={handleVerifyOTP}
                                    loading={loading}
                                    disabled={!otp}
                                    size="md"
                                    icon={<Ionicons name="checkmark-circle" size={16} color="#fff" />}
                                    style={styles.button}
                                />
                                <View style={styles.resendContainer}>
                                    <Button
                                        title={
                                            resendBlocked
                                                ? `Blocked: ${blockedUntil ? Math.ceil((blockedUntil - Date.now()) / 60000) : 0} min`
                                                : counter > 0
                                                    ? `Resend in ${counter}s`
                                                    : "Resend OTP"
                                        }
                                        variant="link"
                                        onPress={handleSendOTP}
                                        disabled={counter > 0 || resendBlocked || loading}
                                        textStyle={[
                                            styles.resendText,
                                            (counter > 0 || resendBlocked) && styles.resendTextDisabled
                                        ]}
                                        style={styles.resendButton}
                                    />
                                    {resendCount > 0 && !resendBlocked && (
                                        <Text style={styles.resendAttemptsText}>
                                            {resendCount}/3 attempts
                                        </Text>
                                    )}
                                </View>
                                <Button
                                    title="Back to Phone Number"
                                    variant="ghost"
                                    onPress={() => {
                                        setStep('phone');
                                        setOtp('');
                                    }}
                                    style={styles.backButton}
                                />
                            </View>
                        )}

                        {step === 'phone' && (
                            <View style={styles.footerLinkContainer}>
                                <Text style={styles.footerText}>New user? </Text>
                                <Button
                                    title="Sign Up"
                                    variant="link"
                                    onPress={() => navigation.navigate('SignUp')}
                                    style={styles.linkButton}
                                    textStyle={styles.linkButtonText}
                                />
                            </View>
                        )}
                    </Card>

                    {/* Features */}
                    <View style={styles.features}>
                        <View style={styles.featureItem}>
                            <View style={styles.featureIcon}>
                                <Ionicons name="bar-chart-outline" size={20} color="#3B82F6" />
                            </View>
                            <Text style={styles.featureTitle}>Digital Ledger</Text>
                            <Text style={styles.featureText}>Track credits & payments</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <View style={styles.featureIcon}>
                                <Text style={styles.rupeeIcon}>₹</Text>
                            </View>
                            <Text style={styles.featureTitle}>UPI Payments</Text>
                            <Text style={styles.featureText}>Accept payments easily</Text>
                        </View>
                    </View>
                </ScrollView>
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
                        <View style={[styles.toastIcon, toastType === 'error' && { backgroundColor: '#EF4444' }]}>
                            <Ionicons name={toastType === 'error' ? "alert-circle" : "checkmark-circle"} size={20} color="#fff" />
                        </View>
                        <Text style={styles.toastText}>{toastMessage}</Text>
                    </View>
                </Animated.View>
            )}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 60, // Consistent with SignUp
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    titleContainer: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    logoContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 14,
        color: colors.gray[600],
    },
    card: {
        padding: 20,
        marginHorizontal: 0,
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.gray[800],
        textAlign: 'center',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 14,
        color: colors.gray[600],
        textAlign: 'center',
        marginBottom: 16,
    },
    form: {
        marginTop: 8,
    },
    input: {
        marginBottom: 12,
    },
    button: {
        marginTop: 8,
    },
    backButton: {
        marginTop: 8,
    },
    features: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 24,
    },
    featureItem: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 12,
        padding: 16,
        flex: 1,
        marginHorizontal: 6,
    },
    featureIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    rupeeIcon: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#3B82F6',
    },
    featureTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.gray[700],
        marginBottom: 2,
    },
    featureText: {
        fontSize: 10,
        color: colors.gray[500],
        textAlign: 'center',
    },
    footerLinkContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    footerText: {
        fontSize: 14,
        color: colors.gray[600],
    },
    linkButton: {
        minWidth: 0,
        paddingHorizontal: 0,
        paddingVertical: 0,
        height: 'auto',
    },
    linkButtonText: {
        color: colors.primary.blue,
        fontWeight: 'bold',
        fontSize: 14,
    },
    resendContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingHorizontal: 8,
    },
    resendButton: {
        minWidth: 0,
        paddingHorizontal: 0,
        paddingVertical: 0,
        height: 'auto',
    },
    resendText: {
        color: colors.primary.blue,
        fontWeight: '600',
        fontSize: 14,
    },
    resendTextDisabled: {
        color: colors.gray[400],
    },
    resendAttemptsText: {
        fontSize: 12,
        color: colors.gray[500],
    },
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
});

export default LoginScreen;

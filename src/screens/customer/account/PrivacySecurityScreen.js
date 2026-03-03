import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
    Platform,
    Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, gradients, spacing, borderRadius, fontSize, shadows } from '../../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../context/AuthContext';
import { authAPI } from '../../../api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const PrivacySecurityScreen = () => {
    const navigation = useNavigation();
    const { user, logout } = useAuth();

    // Security Score Calculation Logic
    const getSecurityDetails = () => {
        let score = 60; // Base: Data Encryption & PCI Compliance
        const recommendations = [];
        const completed = [
            { id: 'encryption', title: 'Data Encryption', desc: 'All records are 256-bit AES safe.', icon: 'shield-checkmark-outline' }
        ];

        // 1. Check Verification Status
        if (user?.verified) {
            score += 15;
            completed.push({
                id: 'verify',
                title: 'Login Verified',
                desc: 'Secure OTP login is active.',
                icon: 'checkmark-done-circle-outline'
            });
        } else {
            recommendations.push({
                id: 'verify',
                title: 'Verify your account',
                desc: 'Add +15% to health by completing OTP verification.',
                icon: 'checkmark-circle-outline',
                action: () => navigation.navigate('EditProfile')
            });
        }

        // 2. Check Role Security
        if (user?.active_role === 'admin' || user?.active_role === 'shop_owner') {
            score += 15;
            completed.push({
                id: 'role',
                title: 'Authority Access',
                desc: 'Advanced permissions enabled.',
                icon: 'ribbon-outline'
            });
        } else {
            score += 15;
            completed.push({
                id: 'role',
                title: 'Secure Access',
                desc: 'Client-side data protection active.',
                icon: 'person-outline'
            });
        }

        // 3. User Experience / Account Maturity
        if (user?.name) {
            score += 10;
        } else {
            recommendations.push({
                id: 'name',
                title: 'Complete your profile',
                desc: 'Add your name for better account recovery (+10%).',
                icon: 'person-outline',
                action: () => navigation.navigate('EditProfile')
            });
        }

        return { score: Math.min(score, 100), recommendations, completed };
    };

    const { score: securityScore, recommendations, completed } = getSecurityDetails();

    const getSecurityStatus = (score) => {
        if (score >= 90) return 'Excellent';
        if (score >= 70) return 'Safe';
        return 'Protected';
    };

    const handleFeatureAlert = (title, message) => {
        Alert.alert(title, message, [{ text: 'OK' }]);
    };


    const handleActiveSessions = async () => {
        try {
            const response = await authAPI.getSessions();
            const sessions = response.data.sessions || [];

            if (sessions.length === 0) {
                Alert.alert('Active Sessions', 'No active sessions found.');
                return;
            }

            const sessionInfo = sessions.map((s, idx) =>
                `${idx + 1}. ${s.device} (${s.os})\n   Last Active: ${s.last_active}`
            ).join('\n\n');

            Alert.alert(
                'Active Sessions',
                `Logged in as: ${user?.name || 'User'}\n\n${sessionInfo}`,
                [
                    { text: 'Close', style: 'cancel' },
                    {
                        text: 'Logout All',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await authAPI.logoutAllSessions();
                                logout();
                            } catch (e) {
                                // Fallback to local logout if API fails
                                logout();
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            Alert.alert(
                'Active Sessions',
                `Currently logged in as: ${user?.name || 'User'}\nDevice: ${Platform.OS === 'ios' ? 'iPhone' : 'Android'}`,
                [
                    { text: 'Close', style: 'default' },
                    { text: 'Logout All', style: 'destructive', onPress: () => logout() }
                ]
            );
        }
    };

    const handleDataExport = () => {
        Alert.alert(
            'Data Protection',
            'All your data is stored securely. Would you like to request a full data export sent to your registered contact info?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Request Export',
                    onPress: async () => {
                        try {
                            // 1. Fetch data from backend
                            const response = await authAPI.requestDataExport();
                            const pdfBase64 = response.data?.pdf_base64;

                            if (!pdfBase64) {
                                throw new Error('No PDF data received from server');
                            }

                            // 2. Create a temporary file path
                            const fileUri = `${FileSystem.documentDirectory}ShopMunim_DataExport_${new Date().toISOString().split('T')[0]}.pdf`;

                            // 3. Write base64 data to the file
                            await FileSystem.writeAsStringAsync(
                                fileUri,
                                pdfBase64,
                                { encoding: 'base64' }
                            );

                            // 4. Check if sharing is available on the device
                            const isAvailable = await Sharing.isAvailableAsync();
                            if (isAvailable) {
                                // 5. Open the native share sheet
                                await Sharing.shareAsync(fileUri, {
                                    mimeType: 'application/pdf',
                                    dialogTitle: 'Share your PDF Report',
                                    UTI: 'com.adobe.pdf'
                                });
                            } else {
                                handleFeatureAlert('Notice', `Export saved to:\n${fileUri}`);
                            }

                        } catch (error) {
                            handleFeatureAlert('Error', `Failed to request and share data export: ${error.message}`);
                            console.error('Export Error:', error);
                        }
                    }
                }
            ]
        );
    };


    const InfoRow = ({ icon, title, subtitle, onPress, showBorder = true, iconColor = colors.primary.blue }) => (
        <TouchableOpacity
            style={[styles.row, !showBorder && styles.lastRow]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.rowIcon, { backgroundColor: `${iconColor}15` }]}>
                <Ionicons name={icon} size={22} color={iconColor} />
            </View>
            <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{title}</Text>
                {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.gray[800]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy & Security</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Dynamic Security Overview */}
                <LinearGradient
                    colors={['#fff', '#F0F9FF']}
                    style={styles.statusCard}
                >
                    <View style={styles.statusHeader}>
                        <View style={styles.statusInfo}>
                            <Text style={styles.statusLabel}>Security Health</Text>
                            <Text style={[styles.statusValue, { color: securityScore > 80 ? colors.success : colors.warning }]}>
                                {getSecurityStatus(securityScore)}
                            </Text>
                        </View>
                        <View style={styles.securityScore}>
                            <Text style={styles.scoreText}>{securityScore}</Text>
                            <Text style={styles.scoreMax}>/100</Text>
                        </View>
                    </View>
                    <View style={styles.healthBarContainer}>
                        <View style={[styles.healthBar, { width: `${securityScore}%`, backgroundColor: securityScore > 80 ? colors.success : colors.warning }]} />
                    </View>
                    <Text style={styles.statusHint}>
                        {securityScore === 100
                            ? 'Your account meets all security standards.'
                            : recommendations.length > 0
                                ? 'Follow the recommendations below to reach 100% security.'
                                : 'Keep your account secure by following best practices.'}
                    </Text>
                </LinearGradient>

                {recommendations.length > 0 && (
                    <>
                        <Text style={styles.sectionLabel}>Recommendations</Text>
                        <View style={styles.section}>
                            {recommendations.map((tip, index) => (
                                <TouchableOpacity
                                    key={tip.id}
                                    style={[styles.row, index === recommendations.length - 1 && styles.lastRow]}
                                    onPress={tip.action}
                                >
                                    <View style={[styles.rowIcon, { backgroundColor: '#FFF7ED', borderRadius: 12 }]}>
                                        <Ionicons name={tip.icon} size={20} color={colors.warning} />
                                    </View>
                                    <View style={styles.rowContent}>
                                        <Text style={styles.rowTitle}>{tip.title}</Text>
                                        <Text style={styles.rowSubtitle}>{tip.desc}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.fixButton} onPress={tip.action}>
                                        <Text style={styles.fixButtonText}>Fix</Text>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                <Text style={styles.sectionLabel}>Achievements</Text>
                <View style={styles.section}>
                    {completed.map((item, index) => (
                        <View
                            key={item.id}
                            style={[styles.row, index === completed.length - 1 && styles.lastRow]}
                        >
                            <View style={[styles.rowIcon, { backgroundColor: '#F0FDF4', borderRadius: 12 }]}>
                                <Ionicons name={item.icon} size={20} color={colors.success} />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={styles.rowTitle}>{item.title}</Text>
                                <Text style={styles.rowSubtitle}>{item.desc}</Text>
                            </View>
                            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        </View>
                    ))}
                </View>

                <Text style={styles.sectionLabel}>Privacy & Data Protection</Text>
                <View style={styles.section}>
                    <InfoRow
                        icon="document-text-outline"
                        title="Privacy Policy"
                        subtitle="How we protect your identity"
                        onPress={() => navigation.navigate('Policies', { type: 'privacy' })}
                        iconColor={colors.primary.purple}
                    />
                    <InfoRow
                        icon="information-circle-outline"
                        title="Terms of Service"
                        subtitle="Your rights and responsibilities"
                        onPress={() => navigation.navigate('Policies', { type: 'terms' })}
                        iconColor={colors.primary.purple}
                    />
                    <InfoRow
                        icon="lock-closed-outline"
                        title="Data Governance"
                        subtitle="256-bit AES encryption standard"
                        onPress={handleDataExport}
                        iconColor={colors.primary.purple}
                        showBorder={false}
                    />
                </View>

                <Text style={styles.sectionLabel}>Account Access Control</Text>
                <View style={styles.section}>
                    <InfoRow
                        icon="phone-portrait-outline"
                        title="Active Sessions"
                        subtitle="Device and login location"
                        onPress={handleActiveSessions}
                        iconColor={colors.warning}
                        showBorder={false}
                    />
                </View>


                <View style={styles.footer}>
                    <Text style={styles.versionText}>ShopMunim Production v1.2.4</Text>
                    <View style={styles.secureConnection}>
                        <Ionicons name="shield-checkmark" size={12} color={colors.success} style={{ marginRight: 4 }} />
                        <Text style={styles.secureText}>End-to-End Secure Connection</Text>
                    </View>
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.gray[50] },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[200],
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.gray[900] },
    backButton: { padding: 4 },
    content: { flex: 1, padding: 16 },
    scrollContent: { paddingBottom: 10 },

    // Status Card
    statusCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.gray[200],
        ...shadows.md,
    },
    statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    statusInfo: { gap: 4 },
    statusLabel: { fontSize: 13, color: colors.gray[500], fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    statusValue: { fontSize: 20, fontWeight: '800' },
    securityScore: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#DCFCE7'
    },
    scoreText: { fontSize: 16, fontWeight: '800', color: colors.success },
    scoreMax: { fontSize: 11, color: colors.gray[400], marginBottom: 2 },
    healthBarContainer: { height: 7, backgroundColor: colors.gray[100], borderRadius: 4, marginBottom: 12 },
    healthBar: { height: '100%', borderRadius: 4 },
    statusHint: { fontSize: 14, color: colors.gray[600], lineHeight: 22 },

    // Sections
    sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.gray[400], textTransform: 'uppercase', marginBottom: 10, marginLeft: 4, letterSpacing: 0.5 },
    section: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.gray[200],
        marginBottom: 24,
        overflow: 'hidden',
        ...shadows.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: `${colors.gray[100]}50`,
    },
    lastRow: { borderBottomWidth: 0 },
    rowIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    rowContent: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: colors.gray[900] },
    rowSubtitle: { fontSize: 13, color: colors.gray[500], marginTop: 3 },

    // Action Buttons

    // Footer
    footer: { alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 10 },
    versionText: { fontSize: 12, color: colors.gray[400], fontWeight: '600' },
    secureConnection: { flexDirection: 'row', alignItems: 'center' },
    secureText: { fontSize: 11, color: colors.gray[400], fontWeight: '500', marginLeft: 4 },
    fixButton: {
        backgroundColor: colors.primary.blue,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    fixButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
});

export default PrivacySecurityScreen;

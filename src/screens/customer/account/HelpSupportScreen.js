import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, LayoutAnimation, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, gradients, spacing, borderRadius, fontSize, shadows } from '../../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

// LayoutAnimation is natively handled in newer architectures

const HelpSupportScreen = () => {
    const navigation = useNavigation();
    const [expandedId, setExpandedId] = useState(null);

    const handleContactSupport = () => {
        Linking.openURL('mailto:support@xmunim.com');
    };

    const handleWhatsAppSupport = () => {
        Linking.openURL('whatsapp://send?phone=+919876543210&text=Hi XMunim Support, I need help.');
    };

    const toggleExpand = (id) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const InfoRow = ({ icon, title, subtitle, onPress, showBorder = true, iconColor = colors.primary.blue }) => (
        <TouchableOpacity
            style={[styles.row, !showBorder && styles.lastRow]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.rowIcon, { backgroundColor: `${iconColor} 15` }]}>
                <Ionicons name={icon} size={22} color={iconColor} />
            </View>
            <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{title}</Text>
                {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
        </TouchableOpacity>
    );

    const FAQRow = ({ id, icon, title, answer, showBorder = true, iconColor = colors.primary.purple }) => {
        const isExpanded = expandedId === id;
        return (
            <View style={[
                styles.faqRowContainer,
                showBorder && styles.borderBottom,
                isExpanded && styles.expandedRowBg
            ]}>
                <TouchableOpacity
                    style={styles.row}
                    onPress={() => toggleExpand(id)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.rowIcon, { backgroundColor: `${iconColor}15` }]}>
                        <Ionicons name={icon} size={22} color={iconColor} />
                    </View>
                    <View style={styles.rowContent}>
                        <Text style={[styles.rowTitle, isExpanded && { color: iconColor, fontWeight: '700' }]}>{title}</Text>
                    </View>
                    <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={isExpanded ? iconColor : colors.gray[400]}
                    />
                </TouchableOpacity>
                {isExpanded && (
                    <View style={styles.answerWrapper}>
                        <View style={[styles.answerSideBorder, { backgroundColor: iconColor }]} />
                        <View style={styles.answerContainer}>
                            <Text style={styles.answerText}>{answer}</Text>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.gray[800]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help & Support</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Support Overview Card */}
                <LinearGradient
                    colors={['#fff', '#F0F9FF']}
                    style={styles.statusCard}
                >
                    <View style={styles.statusHeader}>
                        <View style={styles.statusInfo}>
                            <Text style={styles.statusLabel}>Support Center</Text>
                            <Text style={[styles.statusValue, { color: colors.primary.blue }]}>Active 24/7</Text>
                        </View>
                        <View style={styles.supportBadge}>
                            <Ionicons name="headset-outline" size={20} color={colors.primary.blue} />
                        </View>
                    </View>
                    <Text style={styles.statusHint}>
                        Our team is dedicated to providing you with the best experience. Reach out for any assistance.
                    </Text>
                </LinearGradient>

                <Text style={styles.sectionLabel}>Direct Support</Text>
                <View style={styles.section}>
                    <InfoRow
                        icon="mail-outline"
                        title="Email Support"
                        subtitle="support@xmunim.com"
                        onPress={handleContactSupport}
                        iconColor={colors.primary.blue}
                    />
                    <InfoRow
                        icon="logo-whatsapp"
                        title="WhatsApp Channel"
                        subtitle="Instant help on chat"
                        onPress={handleWhatsAppSupport}
                        iconColor={colors.success}
                        showBorder={false}
                    />
                </View>

                <Text style={styles.sectionLabel}>Common Questions</Text>
                <View style={styles.section}>
                    <FAQRow
                        id="pay"
                        icon="card-outline"
                        title="How to pay a shop?"
                        answer="To settle your dues, go to the 'Payments' tab, select your shop from the list, enter the amount you wish to pay, and complete the transaction via any UPI app or inform the shop owner about your cash payment."
                    />
                    <FAQRow
                        id="shops"
                        icon="business-outline"
                        title="Accessing multiple shops?"
                        answer="Yes! XMunim is built for multiple shops. When any shop owner adds your phone number to their ledger, that shop will automatically appear in your 'Ledger' and 'Payments' tabs. No setup required."
                    />
                    <FAQRow
                        id="security"
                        icon="shield-checkmark-outline"
                        title="Is my data safe?"
                        answer="Your financial data is protected using 256-bit AES encryption. Only you and the respective shop owner can view your transaction history. We never share your data with third parties."
                        showBorder={false}
                    />
                </View>

                <View style={styles.footer}>
                    <Text style={styles.versionText}>XMunim Production v{Constants.expoConfig?.version || '1.0.0'}</Text>
                    <View style={styles.secureConnection}>
                        <Ionicons name="shield-checkmark" size={12} color={colors.success} style={{ marginRight: 4 }} />
                        <Text style={styles.secureText}>Official Support Channel</Text>
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
    supportBadge: { backgroundColor: '#F0F9FF', padding: 12, borderRadius: 24, borderWidth: 1, borderColor: '#DBEAFE' },
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

    // Footer
    footer: { alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 10 },
    versionText: { fontSize: 12, color: colors.gray[400], fontWeight: '600' },
    secureConnection: { flexDirection: 'row', alignItems: 'center' },
    secureText: { fontSize: 11, color: colors.gray[400], fontWeight: '500', marginLeft: 4 },

    // FAQ Accordion styles
    faqRowContainer: { width: '100%', backgroundColor: '#fff' },
    expandedRowBg: { backgroundColor: '#F9FAFB' },
    borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
    answerWrapper: {
        flexDirection: 'row',
        paddingHorizontal: 18,
        paddingBottom: 22,
    },
    answerSideBorder: {
        width: 3,
        borderRadius: 4,
        opacity: 0.4, // More defined accent
        marginLeft: 20, // Better alignment with center of 44px icon
    },
    answerContainer: {
        flex: 1,
        paddingLeft: 34, // Refined alignment (18 + 20 + 3 + 34 = 75px roughly)
        paddingRight: 10,
    },
    answerText: {
        fontSize: 14,
        color: colors.gray[700], // Stronger contrast for better readability
        lineHeight: 22,
        fontWeight: '500',
    },
});

export default HelpSupportScreen;

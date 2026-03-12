import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, shadows } from '../../../theme';

const PoliciesScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { type } = route.params || { type: 'privacy' }; // 'privacy' or 'terms'

    const isPrivacy = type === 'privacy';
    const title = isPrivacy ? 'Privacy Protocol' : 'Terms of Service';

    const PolicySection = ({ title, content, number }) => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <View style={styles.numberBadge}>
                    <Text style={styles.numberText}>{number}</Text>
                </View>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.sectionContent}>
                <Text style={styles.policyText}>{content}</Text>
            </View>
        </View>
    );

    const renderContent = () => {
        if (isPrivacy) {
            return (
                <>
                    <PolicySection
                        number="01"
                        title="Data Collection"
                        content="We collect information necessary for ledger management, including your name, phone number, and transaction history with connected shops."
                    />
                    <PolicySection
                        number="02"
                        title="Data Usage"
                        content="Your data is used solely to maintain your financial records, provide account notifications, and ensure secure login via OTP."
                    />
                    <PolicySection
                        number="03"
                        title="Account Security"
                        content="We use 256-bit encryption for all data storage. Your transaction records are private between you and the respective shop owner."
                    />
                    <PolicySection
                        number="04"
                        title="Your Rights"
                        content="You have the right to export your data or delete your account at any time through the Privacy & Security settings."
                    />
                </>
            );
        } else {
            return (
                <>
                    <PolicySection
                        number="01"
                        title="Acceptance of Terms"
                        content="By using XMunim, you agree to these terms and conditions. If you do not agree, please discontinue use of the application."
                    />
                    <PolicySection
                        number="02"
                        title="Accurate Records"
                        content="XMunim is a tool for record-keeping. While we provide secure storage, users are responsible for verifying transaction amounts and settlements with shop owners."
                    />
                    <PolicySection
                        number="03"
                        title="Prohibited Use"
                        content="Users may not use the platform for fraudulent activities, money laundering, or any illegal financial transactions."
                    />
                    <PolicySection
                        number="04"
                        title="Disclaimer"
                        content="XMunim provides the service 'as is' and is not liable for disputes between customers and shop owners regarding ledger balances."
                    />
                </>
            );
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.gray[800]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <View style={styles.infoBanner}>
                        <Ionicons name="information-circle" size={20} color={colors.primary.blue} />
                        <Text style={styles.lastUpdated}>Status: Active (Last Updated Feb 2026)</Text>
                    </View>

                    <Text style={styles.sectionLabel}>LEGAL COMPLIANCE</Text>

                    {renderContent()}

                    <View style={styles.footerNote}>
                        <Text style={styles.footerText}>
                            Questions regarding our {title.toLowerCase()}? {'\n'}
                            Reach out to our compliance team at support@xmunim.com
                        </Text>
                    </View>
                </View>
                <View style={{ height: 20 }} />
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
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 10 },
    content: { padding: 16 },

    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${colors.primary.blue}10`,
        padding: 14,
        borderRadius: 12,
        marginBottom: 16,
        gap: 10,
    },
    lastUpdated: { fontSize: 13, color: colors.primary.blue, fontWeight: '700' },

    sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.gray[400], textTransform: 'uppercase', marginBottom: 12, marginLeft: 4, letterSpacing: 0.5 },

    section: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.gray[200],
        marginBottom: 12,
        overflow: 'hidden',
        ...shadows.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: colors.gray[50],
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[100],
    },
    numberBadge: {
        backgroundColor: colors.primary.blue,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 12,
    },
    numberText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.gray[900] },

    sectionContent: { padding: 18 },
    policyText: {
        fontSize: 14,
        color: colors.gray[700],
        lineHeight: 22,
        fontWeight: '500',
    },

    footerNote: {
        marginTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 10,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        color: colors.gray[500],
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '600',
    },
});

export default PoliciesScreen;

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, shadows } from '../../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

const AboutScreen = () => {
    const navigation = useNavigation();

    const InfoRow = ({ icon, title, subtitle, onPress, showBorder = true, iconColor = colors.primary.blue }) => (
        <TouchableOpacity
            style={[styles.row, !showBorder && styles.lastRow]}
            onPress={onPress}
            activeOpacity={0.7}
            disabled={!onPress}
        >
            <View style={[styles.rowIcon, { backgroundColor: `${iconColor}15` }]}>
                <Ionicons name={icon} size={22} color={iconColor} />
            </View>
            <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{title}</Text>
                {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
            </View>
            {onPress && <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.gray[800]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>About XMunim</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Hero Branding Card */}
                <LinearGradient
                    colors={['#fff', '#F0F9FF']}
                    style={styles.statusCard}
                >
                    <View style={styles.statusHeader}>
                        <View style={styles.statusInfo}>
                            <Text style={styles.statusLabel}>XMunim Platform</Text>
                            <Text style={[styles.statusValue, { color: colors.primary.blue }]}>v{Constants.expoConfig?.version || '1.0.0'} Production</Text>
                        </View>
                        <View style={styles.logoBadge}>
                            <Text style={styles.logoText}>XM</Text>
                        </View>
                    </View>
                    <Text style={styles.statusHint}>
                        Empowering local commerce through secure digital ledgers and seamless merchant communication.
                    </Text>
                </LinearGradient>

                <Text style={styles.sectionLabel}>Our Innovation</Text>
                <View style={styles.section}>
                    <View style={styles.missionCard}>
                        <Text style={styles.missionText}>
                            XMunim is designed to bridge the gap between traditional local shop accounting and modern digital convenience.
                            Our goal is to empower every shop owner and customer with transparent, real-time, and secure ledger tracking.
                        </Text>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Core Features</Text>
                <View style={styles.section}>
                    <InfoRow
                        icon="shield-checkmark-outline"
                        title="Vault Security"
                        subtitle="Bank-grade encryption for every record."
                        iconColor={colors.success}
                    />
                    <InfoRow
                        icon="flash-outline"
                        title="Hyper Speed"
                        subtitle="Instant sync across all your devices."
                        iconColor={colors.primary.blue}
                    />
                    <InfoRow
                        icon="people-outline"
                        title="Community Trust"
                        subtitle="Building transparency in local commerce."
                        iconColor={colors.primary.purple}
                        showBorder={false}
                    />
                </View>

                <Text style={styles.sectionLabel}>Resources & Legal</Text>
                <View style={styles.section}>
                    <InfoRow
                        icon="document-text-outline"
                        title="Privacy Protocol"
                        subtitle="Your identity protection standards"
                        onPress={() => navigation.navigate('Policies', { type: 'privacy' })}
                        iconColor={colors.primary.indigo}
                    />
                    <InfoRow
                        icon="information-circle-outline"
                        title="Terms of Service"
                        subtitle="Usage and legal agreements"
                        onPress={() => navigation.navigate('Policies', { type: 'terms' })}
                        iconColor={colors.warning}
                    />
                    <InfoRow
                        icon="globe-outline"
                        title="Official Hub"
                        subtitle="www.xmunim.com"
                        onPress={() => Linking.openURL('https://xmunim.com')}
                        iconColor={colors.primary.blue}
                        showBorder={false}
                    />
                </View>

                <View style={styles.footer}>
                    <Text style={styles.versionText}>XMunim Production v{Constants.expoConfig?.version || '1.0.0'}</Text>
                    <View style={styles.secureConnection}>
                        <Ionicons name="shield-checkmark" size={14} color="#10B981" />
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
    scrollContent: { paddingBottom: 5 },

    // Status Card (Hero)
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
    logoBadge: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.primary.blue,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.sm,
    },
    logoText: { color: '#fff', fontSize: 20, fontWeight: '900' },
    statusHint: { fontSize: 14, color: colors.gray[700], lineHeight: 22, fontWeight: '500' },

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
    missionCard: { padding: 18 },
    missionText: { fontSize: 14, color: colors.gray[700], lineHeight: 22, fontWeight: '500' },

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
    footer: { alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 32 },
    versionText: { fontSize: 12, color: colors.gray[400], fontWeight: '600' },
    secureConnection: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    secureText: { fontSize: 11, color: colors.gray[400], fontWeight: '500' },
});

export default AboutScreen;

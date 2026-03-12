import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
// import ShopFooter from '../../components/shopowner/ShopFooter';

const QRShareScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, shop } = route.params || {};

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Share Your Shop</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* User Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={32} color="#8B5CF6" />
                    </View>
                    <Text style={styles.profileName}>{user?.name || 'User'}</Text>
                    <Text style={styles.profilePhone}>+91 {user?.phone}</Text>
                    <View style={styles.shopBadge}>
                        <Text style={styles.shopBadgeText}>Shop Owner</Text>
                    </View>
                </View>

                {/* Share Your Shop Card */}
                <View style={styles.shareCard}>
                    <View style={styles.shareHeader}>
                        <Ionicons name="qr-code" size={20} color="#3B82F6" />
                        <Text style={styles.shareTitle}>Share Your Shop</Text>
                    </View>
                    <Text style={styles.shareDesc}>Generate QR code and shareable link for customers to connect</Text>
                    <View style={styles.blueSection}>
                        <Text style={styles.blueSectionTitle}>Shop QR Code & Share Link</Text>
                    </View>
                </View>

                {/* QR Code Display Card */}
                <View style={styles.qrCard}>
                    <Text style={styles.qrLabel}>My Shop</Text>
                    <Text style={styles.qrId}>ID: {shop?._id?.slice(-8) || shop?.id?.slice(-8) || 'SHOP001'}</Text>
                    <Text style={styles.qrLocation}>📍 {shop?.location || 'Location'}</Text>

                    <Text style={styles.qrTitle}>QR Code</Text>
                    <Text style={styles.qrHint}>Customers can scan this code to connect with your shop instantly</Text>

                    {/* QR Code Placeholder */}
                    <View style={styles.qrCodeBox}>
                        <Ionicons name="qr-code" size={140} color="#333" />
                    </View>

                    <TouchableOpacity style={styles.browserButton}>
                        <Text style={styles.browserButtonText}>Open in Browser</Text>
                    </TouchableOpacity>

                    {/* Download & Share Buttons */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.downloadBtn}>
                            <Ionicons name="download-outline" size={18} color="#3B82F6" />
                            <Text style={styles.downloadBtnText}>Download</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.shareBtn}>
                            <Ionicons name="share-outline" size={18} color="#fff" />
                            <Text style={styles.shareBtnText}>Share</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.scanHint}>👆 Customers can scan this code to connect with your shop</Text>
                </View>

                {/* Shareable Link Section */}
                <View style={styles.linkCard}>
                    <Text style={styles.linkTitle}>Shareable Link</Text>
                    <Text style={styles.linkDesc}>Send this link to your customers via SMS, WhatsApp, or any messaging app</Text>

                    <View style={styles.linkInputRow}>
                        <Ionicons name="link" size={18} color="#9CA3AF" />
                        <Text style={styles.linkText} numberOfLines={1}>xmunim.com/connect/{shop?.name ? encodeURIComponent(shop.name.replace(/\s+/g, '')) : 'Shop'}/{shop?.shop_code || 'Code'}</Text>
                    </View>

                    <TouchableOpacity style={styles.copyBtn}>
                        <Ionicons name="copy-outline" size={18} color="#fff" />
                        <Text style={styles.copyBtnText}>Copy Link</Text>
                    </TouchableOpacity>

                    <View style={styles.shareRow}>
                        <TouchableOpacity style={styles.whatsappBtn}>
                            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                            <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.shareBlueBtn}>
                            <Ionicons name="share-social-outline" size={18} color="#fff" />
                            <Text style={styles.shareBlueBtnText}>Share</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.tipHint}>💡 Tip: Share in groups to reach more customers at once</Text>
                </View>

                {/* Marketing Tips */}
                <View style={styles.tipsCard}>
                    <View style={styles.tipsHeader}>
                        <Ionicons name="bulb" size={20} color="#F59E0B" />
                        <Text style={styles.tipsTitle}>Marketing Tips</Text>
                    </View>

                    <View style={styles.tipItem}>
                        <Text style={styles.tipIcon}>📍</Text>
                        <View style={styles.tipContent}>
                            <Text style={styles.tipLabel}>At Your Shop</Text>
                            <Text style={styles.tipText}>Print and display the QR code at your billing counter, entrance, or anywhere visible</Text>
                        </View>
                    </View>

                    <View style={styles.tipItem}>
                        <Text style={styles.tipIcon}>📱</Text>
                        <View style={styles.tipContent}>
                            <Text style={styles.tipLabel}>Social Media</Text>
                            <Text style={styles.tipText}>Share on WhatsApp, Facebook, or Instagram to reach more customers</Text>
                        </View>
                    </View>

                    <View style={styles.tipItem}>
                        <Text style={styles.tipIcon}>💳</Text>
                        <View style={styles.tipContent}>
                            <Text style={styles.tipLabel}>Business Cards</Text>
                            <Text style={styles.tipText}>Add QR to business cards or pamphlets for easy customer onboarding</Text>
                        </View>
                    </View>
                </View>

                {/* Account Settings in QR Screen */}
                <View style={styles.settingsCard}>
                    <TouchableOpacity style={styles.settingItem}>
                        <Text style={styles.settingIcon}>📝</Text>
                        <Text style={styles.settingText}>Edit Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem}>
                        <Text style={styles.settingIcon}>🔔</Text>
                        <Text style={styles.settingText}>Notifications</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem}>
                        <Text style={styles.settingIcon}>🔒</Text>
                        <Text style={styles.settingText}>Privacy & Security</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem}>
                        <Text style={styles.settingIcon}>🌐</Text>
                        <Text style={styles.settingText}>Language</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem}>
                        <Text style={styles.settingIcon}>❓</Text>
                        <Text style={styles.settingText}>Help & Support</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.settingItem, styles.settingItemLast]}>
                        <Text style={styles.settingIcon}>🚪</Text>
                        <Text style={[styles.settingText, styles.logoutText]}>Logout</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerBrand}>XMunim</Text>
                    <Text style={styles.footerVersion}>Version 1.0.0</Text>
                    <Text style={styles.footerTagline}>Digital Credit & Payment Ledger</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    scroll: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
    profileSection: {
        backgroundColor: '#fff',
        alignItems: 'center',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#EDE9FE',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    profileName: { fontSize: 18, fontWeight: '600', color: '#111827' },
    profilePhone: { fontSize: 14, color: '#6B7280', marginTop: 2 },
    shopBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
    },
    shopBadgeText: { fontSize: 12, color: '#374151' },
    shareCard: {
        backgroundColor: '#fff',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    shareHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    shareTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
    shareDesc: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
    blueSection: {
        backgroundColor: '#3B82F6',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    blueSectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
    qrCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    qrLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
    qrId: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    qrLocation: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    qrTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16 },
    qrHint: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 4 },
    qrCodeBox: {
        width: 180,
        height: 180,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 16,
        borderRadius: 8,
    },
    browserButton: {
        borderWidth: 1,
        borderColor: '#3B82F6',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    browserButtonText: { color: '#3B82F6', fontSize: 14, fontWeight: '500' },
    actionRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 12 },
    downloadBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EFF6FF',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    downloadBtnText: { color: '#3B82F6', fontSize: 14, fontWeight: '500' },
    shareBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    shareBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
    scanHint: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
    linkCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    linkTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
    linkDesc: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
    linkInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        marginBottom: 12,
    },
    linkText: { flex: 1, fontSize: 13, color: '#374151' },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
        marginBottom: 12,
    },
    copyBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
    shareRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    whatsappBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#22C55E',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    whatsappBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
    shareBlueBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    shareBlueBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
    tipHint: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
    tipsCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    tipsTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
    tipItem: { flexDirection: 'row', marginBottom: 12, gap: 12 },
    tipIcon: { fontSize: 20 },
    tipContent: { flex: 1 },
    tipLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
    tipText: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    settingsCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    settingItemLast: { borderBottomWidth: 0 },
    settingIcon: { fontSize: 20, marginRight: 12 },
    settingText: { fontSize: 16, color: '#111827' },
    logoutText: { color: '#EF4444' },

    logoutText: { color: '#EF4444' },

    // Footer Styles
    footer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginTop: 20,
        marginHorizontal: 16,
    },
    footerBrand: { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },
    footerVersion: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
    footerTagline: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

});

export default QRShareScreen;

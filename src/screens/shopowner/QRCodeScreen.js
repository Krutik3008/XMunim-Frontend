// QR Code Screen for shop sharing
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Share,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { Card, Button } from '../../components/ui';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../theme';

const QRCodeScreen = ({ route, navigation }) => {
    const { shop } = route.params;

    // Generate the connect URL
    const connectUrl = `https://xmunim.com/connect/${encodeURIComponent(shop.name.replace(/\s+/g, ''))}/${shop.shop_code}`;

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Join my shop "${shop.name}" on XMunim!\n\nShop Code: ${shop.shop_code}\n\nOr visit: ${connectUrl}`,
                title: `Join ${shop.name} on XMunim`,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const handleCopyCode = () => {
        // Note: In a real app, you'd use Clipboard API
        Alert.alert('Shop Code', `Your shop code is: ${shop.shop_code}`, [
            { text: 'OK' }
        ]);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.gray[800]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Share Shop</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* QR Code Card */}
            <Card style={styles.qrCard}>
                <Text style={styles.shopName}>{shop.name}</Text>
                <Text style={styles.shopCategory}>{shop.category}</Text>

                <View style={styles.qrContainer}>
                    <QRCode
                        value={connectUrl}
                        size={200}
                        backgroundColor={colors.white}
                        color={colors.gray[900]}
                    />
                </View>

                <Text style={styles.scanText}>Scan to connect to this shop</Text>
            </Card>

            {/* Shop Code */}
            <Card style={styles.codeCard}>
                <Text style={styles.codeLabel}>Shop Code</Text>
                <TouchableOpacity style={styles.codeContainer} onPress={handleCopyCode}>
                    <Text style={styles.codeText}>{shop.shop_code}</Text>
                    <Ionicons name="copy-outline" size={20} color={colors.primary.blue} />
                </TouchableOpacity>
                <Text style={styles.codeHint}>Tap to copy</Text>
            </Card>

            {/* Share Options */}
            <View style={styles.shareSection}>
                <Text style={styles.shareTitle}>Share via</Text>
                <View style={styles.shareButtons}>
                    <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                        <View style={[styles.shareIcon, { backgroundColor: colors.success + '20' }]}>
                            <Ionicons name="logo-whatsapp" size={24} color={colors.success} />
                        </View>
                        <Text style={styles.shareButtonText}>WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                        <View style={[styles.shareIcon, { backgroundColor: colors.primary.blue + '20' }]}>
                            <Ionicons name="mail-outline" size={24} color={colors.primary.blue} />
                        </View>
                        <Text style={styles.shareButtonText}>SMS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                        <View style={[styles.shareIcon, { backgroundColor: colors.gray[200] }]}>
                            <Ionicons name="share-outline" size={24} color={colors.gray[700]} />
                        </View>
                        <Text style={styles.shareButtonText}>More</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary.blue} />
                <Text style={styles.infoText}>
                    Customers can scan this QR code or enter the shop code to connect and view their ledger.
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.gray[50],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[100],
    },
    backButton: {
        padding: spacing.sm,
    },
    headerTitle: {
        fontSize: fontSize.xl,
        fontWeight: '600',
        color: colors.gray[800],
    },
    qrCard: {
        margin: spacing.lg,
        alignItems: 'center',
        padding: spacing.xl,
    },
    shopName: {
        fontSize: fontSize.xxl,
        fontWeight: '600',
        color: colors.gray[800],
        marginBottom: spacing.xs,
    },
    shopCategory: {
        fontSize: fontSize.sm,
        color: colors.gray[500],
        textTransform: 'capitalize',
        marginBottom: spacing.lg,
    },
    qrContainer: {
        padding: spacing.lg,
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        ...shadows.sm,
    },
    scanText: {
        fontSize: fontSize.sm,
        color: colors.gray[500],
        marginTop: spacing.lg,
    },
    codeCard: {
        marginHorizontal: spacing.lg,
        alignItems: 'center',
        padding: spacing.lg,
    },
    codeLabel: {
        fontSize: fontSize.sm,
        color: colors.gray[500],
        marginBottom: spacing.sm,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.gray[100],
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
    },
    codeText: {
        fontSize: fontSize.xxl,
        fontWeight: 'bold',
        color: colors.gray[800],
        letterSpacing: 2,
        marginRight: spacing.md,
    },
    codeHint: {
        fontSize: fontSize.xs,
        color: colors.gray[400],
        marginTop: spacing.sm,
    },
    shareSection: {
        padding: spacing.lg,
    },
    shareTitle: {
        fontSize: fontSize.md,
        fontWeight: '500',
        color: colors.gray[700],
        marginBottom: spacing.md,
    },
    shareButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    shareButton: {
        alignItems: 'center',
    },
    shareIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    shareButtonText: {
        fontSize: fontSize.sm,
        color: colors.gray[600],
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.primary.blue + '10',
        padding: spacing.md,
        marginHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
    },
    infoText: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.gray[600],
        marginLeft: spacing.sm,
        lineHeight: 20,
    },
});

export default QRCodeScreen;

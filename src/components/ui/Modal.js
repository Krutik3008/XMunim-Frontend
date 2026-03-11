// Modal Component - Centered/Top-Anchored style
import React, { useState, useEffect } from 'react';
import {
    Modal as RNModal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    useWindowDimensions,
    Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize, shadows } from '../../theme';

const Modal = ({
    visible,
    onClose,
    title,
    description,
    children,
    showCloseButton = true,
    toast = null,
    keyboardShouldPersistTaps = 'handled',
}) => {
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const { height: windowHeight } = useWindowDimensions();

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

    return (
        <RNModal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent={false}
        >
            <View style={styles.overlay}>
                {/* Background overlay that dismisses modal */}
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={onClose}
                />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                    pointerEvents="box-none"
                >
                    <View style={[
                        styles.container,
                        {
                            maxHeight: keyboardVisible ? windowHeight * 0.9 : windowHeight * 0.85,
                            marginTop: keyboardVisible ? 60 : 0
                        }
                    ]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerText}>
                                {title && <Text style={styles.title}>{title}</Text>}
                                {description && <Text style={styles.description}>{description}</Text>}
                            </View>
                            {showCloseButton && (
                                <TouchableOpacity
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        onClose();
                                    }}
                                    style={styles.closeButton}
                                >
                                    <Ionicons name="close" size={24} color={colors.gray[500]} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Content */}
                        <ScrollView
                            style={styles.content}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
                            contentContainerStyle={{ paddingBottom: keyboardVisible ? 310 : 20 }}
                        >
                            {children}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
                {toast}
            </View>
        </RNModal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay || 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyboardView: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        backgroundColor: colors.white,
        borderRadius: 16,
        width: '90%',
        ...shadows.lg,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[100],
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: fontSize.xl,
        fontWeight: '600',
        color: colors.gray[800],
    },
    description: {
        fontSize: fontSize.sm,
        color: colors.gray[500],
        marginTop: spacing.xs,
    },
    closeButton: {
        padding: spacing.xs,
    },
    content: {
        padding: spacing.lg,
    },
});

export default Modal;

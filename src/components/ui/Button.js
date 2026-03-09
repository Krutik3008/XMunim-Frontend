// Custom Button Component with gradient support
import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius, spacing, fontSize } from '../../theme';

const Button = ({
    title,
    onPress,
    variant = 'primary', // primary, secondary, outline, ghost
    size = 'md', // sm, md, lg
    loading = false,
    disabled = false,
    icon,
    style,
    textStyle,
}) => {
    const isDisabled = disabled || loading;

    const getButtonStyle = () => {
        const baseStyle = [styles.button, styles[`size_${size}`]];

        if (variant === 'outline') {
            baseStyle.push(styles.outline);
        } else if (variant === 'ghost' || variant === 'link') {
            baseStyle.push(styles.ghost);
        } else if (variant === 'secondary') {
            baseStyle.push(styles.secondary);
        }

        if (isDisabled) {
            // Only add background-based disabled style for non-transparent variants
            if (variant !== 'ghost' && variant !== 'link') {
                baseStyle.push(styles.disabled);
            } else {
                baseStyle.push(styles.disabledTransparent);
            }
        }

        return baseStyle;
    };

    const getTextStyle = () => {
        const baseStyle = [styles.text, styles[`text_${size}`]];

        if (variant === 'outline' || variant === 'ghost' || variant === 'link') {
            baseStyle.push(styles.textOutline);
        }

        return baseStyle;
    };

    const renderContent = () => (
        <View style={styles.content}>
            {loading ? (
                <ActivityIndicator
                    color={variant === 'outline' || variant === 'ghost' ? colors.primary.blue : colors.white}
                    size="small"
                />
            ) : (
                <>
                    {icon && <View style={styles.iconContainer}>{icon}</View>}
                    <Text style={[...getTextStyle(), textStyle]}>{title}</Text>
                </>
            )}
        </View>
    );

    // Gradient button for primary variant
    if (variant === 'primary' && !isDisabled) {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={isDisabled}
                activeOpacity={0.8}
                style={style}
            >
                <LinearGradient
                    colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.button, styles[`size_${size}`], styles.gradient]}
                >
                    {renderContent()}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.7}
            style={[...getButtonStyle(), style]}
        >
            {renderContent()}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    gradient: {
        borderRadius: borderRadius.lg,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        marginRight: spacing.sm,
    },
    // Size variants
    size_sm: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        minHeight: 36,
    },
    size_md: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        minHeight: 48,
    },
    size_lg: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xxl,
        minHeight: 56,
    },
    // Variant styles
    secondary: {
        backgroundColor: colors.gray[100],
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.primary.blue,
    },
    ghost: {
        backgroundColor: 'transparent',
    },
    disabled: {
        backgroundColor: colors.gray[300],
        opacity: 0.6,
    },
    disabledTransparent: {
        backgroundColor: 'transparent',
        opacity: 0.6,
    },
    // Text styles
    text: {
        fontWeight: '600',
        color: colors.white,
    },
    text_sm: {
        fontSize: fontSize.sm,
    },
    text_md: {
        fontSize: fontSize.lg,
    },
    text_lg: {
        fontSize: fontSize.xl,
    },
    textOutline: {
        color: colors.primary.blue,
    },
});

export default Button;

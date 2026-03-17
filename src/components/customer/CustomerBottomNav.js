// Customer Bottom Navigation Component - Extracted from DashboardScreen
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TabButton = ({ name, icon, label, activeTab, setActiveTab }) => {
    const isActive = activeTab === name;
    return (
        <TouchableOpacity
            style={styles.navItemWrapper}
            onPress={() => setActiveTab(name)}
        >
            <View style={[styles.navItem, isActive && styles.navItemActive]}>
                <Ionicons
                    name={isActive ? icon.replace('-outline', '') : icon}
                    size={20}
                    color={isActive ? '#3B82F6' : '#6B7280'}
                />
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{label}</Text>
            </View>
        </TouchableOpacity>
    );
};

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CustomerBottomNav = ({ activeTab, setActiveTab }) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10), height: 65 + Math.max(insets.bottom, 10) }]}>
            <TabButton name="ledger" icon="book-outline" label="Ledger" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton name="payments" icon="card-outline" label="Payments" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton name="history" icon="time-outline" label="History" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton name="account" icon="person-outline" label="Account" activeTab={activeTab} setActiveTab={setActiveTab} />
        </View>
    );
};

const styles = StyleSheet.create({
    // Bottom Navigation
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
        elevation: 8,
        height: 65,
        zIndex: 1000,
    },
    navItemWrapper: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    navItemActive: {
        backgroundColor: '#EBF5FF', // Original light blue background
    },
    navText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#6B7280',
    },
    navTextActive: {
        color: '#3B82F6',
        fontWeight: 'bold',
    },
});

export default CustomerBottomNav;

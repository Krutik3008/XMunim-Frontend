import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Image } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

// Listener to handle notification taps (opens the file)
Notifications.addNotificationResponseReceivedListener(async response => {
    try {
        const { fileUri, mimeType } = response.notification.request.content.data;
        if (fileUri) {
            if (Platform.OS === 'android') {
                // Convert file:// to content:// for the intent
                const contentUri = await FileSystem.getContentUriAsync(fileUri);

                // Direct open using Android Intent
                await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                    data: contentUri,
                    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                    type: mimeType,
                });
            } else {
                // iOS: shareAsync defaults to a direct preview/share flow
                await Sharing.shareAsync(fileUri, {
                    UTI: mimeType,
                    mimeType: mimeType,
                    dialogTitle: 'Open Report'
                });
            }
        }
    } catch (error) {
        console.error('Error handling notification tap:', error);
    }
});

// Cached download directory URI - persisted so user only picks folder ONCE
let _savedDirUri = null;

/**
 * Initialize notification permissions
 */
export const initNotifications = async () => {
    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return false;
        }

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('downloads', {
                name: 'Downloads',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#304FFE',
            });
        }
        return true;
    } catch (e) {
        console.error('Error initializing notifications:', e);
        return false;
    }
};

/**
 * Show a rich notification for download status
 * @param {string} title - Title of the notification
 * @param {string} body - Body content
 * @param {string} fileName - File name
 * @param {string} fileUri - URI of the saved file
 * @param {string} mimeType - MIME type of the file
 */
export const showDownloadNotification = async (title, body, fileName, fileUri, mimeType) => {
    try {
        // Resolve the brand icon
        const iconAsset = Image.resolveAssetSource(require('../../assets/noti-brand-v1.png'));
        const iconUri = iconAsset?.uri;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: title,
                body: fileName ? `${body}: ${fileName}` : body,
                data: { fileName, fileUri, mimeType },
                sound: true, // Play system notification sound
                priority: 'high', // High priority for prominence in APK
                // Android specific rich notification features
                android: {
                    channelId: 'downloads',
                    color: '#304FFE',
                    largeIcon: iconUri,
                    importance: Notifications.AndroidImportance.MAX,
                    visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
                    sticky: false,
                    autoDismiss: true,
                    pressAction: {
                        id: 'default',
                    },
                },
                // iOS specific
                ios: {
                    attachments: iconUri ? [{ url: iconUri }] : [],
                    _displayInForeground: true,
                },
            },
            trigger: null, // immediate
        });
    } catch (e) {
        console.error('Error showing notification:', e);
    }
};

/**
 * Save file to device with native SAF (Android) or DocumentDirectory (iOS)
 * @param {string} fileName - Name of the file
 * @param {string} base64Content - File content in base64
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<{success: boolean, uri?: string}>}
 */
export const saveFileToDevice = async (fileName, base64Content, mimeType) => {
    // 1. Save to cache directory first (needed for notification open/share)
    const cacheUri = FileSystem.cacheDirectory + fileName;
    try {
        await FileSystem.writeAsStringAsync(cacheUri, base64Content, { encoding: 'base64' });
    } catch (e) {
        console.error('Cache save error:', e);
    }

    if (Platform.OS === 'android') {
        // Load cached directory URI from config file
        if (!_savedDirUri) {
            try {
                const configFile = FileSystem.documentDirectory + '_download_dir.txt';
                const info = await FileSystem.getInfoAsync(configFile);
                if (info.exists) {
                    _savedDirUri = await FileSystem.readAsStringAsync(configFile);
                }
            } catch (e) { }
        }

        // Try saving with cached directory (Android SAF)
        if (_savedDirUri) {
            try {
                const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    _savedDirUri, fileName, mimeType
                );
                await FileSystem.writeAsStringAsync(fileUri, base64Content, { encoding: 'base64' });

                // Show notification with cacheUri (file:// scheme) for direct open
                await showDownloadNotification('Download Complete', 'File saved to storage', fileName, cacheUri, mimeType);

                return { success: true, uri: fileUri };
            } catch (e) {
                _savedDirUri = null; // Reset if it fails (e.g. folder deleted) so we ask again
            }
        }

        // First time or fallback: ask user to pick folder (one time only)
        try {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (!permissions.granted) return { success: false };

            _savedDirUri = permissions.directoryUri;
            const configFile = FileSystem.documentDirectory + '_download_dir.txt';
            await FileSystem.writeAsStringAsync(configFile, _savedDirUri);

            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                _savedDirUri, fileName, mimeType
            );
            await FileSystem.writeAsStringAsync(fileUri, base64Content, { encoding: 'base64' });

            // Show notification
            await showDownloadNotification('Download Complete', 'File saved to storage', fileName, cacheUri, mimeType);

            return { success: true, uri: fileUri };
        } catch (e) {
            console.error('Android save error:', e);
            return { success: false };
        }
    } else {
        // iOS: save to app's document directory
        try {
            const iosPath = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(iosPath, base64Content, { encoding: 'base64' });

            // Show notification with iosPath
            await showDownloadNotification('Download Complete', 'File saved to documents', fileName, iosPath, mimeType);

            return { success: true, uri: iosPath };
        } catch (e) {
            console.error('iOS save error:', e);
            return { success: false };
        }
    }
};

// Helper utility functions

/**
 * Format currency in Indian Rupee format
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount || 0);
};

/**
 * Format date in Indian format
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

/**
 * Format date with time
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date-time string
 */
export const formatDateTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Validate phone number (10 digits)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Is valid
 */
export const isValidPhone = (phone) => {
    return /^[0-9]{10}$/.test(phone);
};

/**
 * Validate OTP (6 digits)
 * @param {string} otp - OTP to validate
 * @returns {boolean} Is valid
 */
export const isValidOTP = (otp) => {
    return /^[0-9]{4,6}$/.test(otp);
};

/**
 * Format phone number with country code
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone
 */
export const formatPhone = (phone) => {
    if (!phone) return '';
    return `+91 ${phone}`;
};

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 chars)
 */
export const getInitials = (name) => {
    if (!name) return '?';
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Max length
 * @returns {string} Truncated text
 */
export const truncate = (text, maxLength = 20) => {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
};

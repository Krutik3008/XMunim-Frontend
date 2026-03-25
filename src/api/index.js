// API Service Layer - Aligned with xmunimappbackend
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend URL - Update this to your backend server IP
// const BACKEND_URL = 'https://xmunim-backend.onrender.com';
const BACKEND_URL = 'http://192.168.29.145:8000';
const API_BASE = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        if (__DEV__) {
            console.log('API Request:', config.method?.toUpperCase(), config.url, config.data);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => {
        if (__DEV__) {
            console.log('API Response:', response.config.url, response.status);
        }
        return response;
    },
    async (error) => {
        if (__DEV__) {
            console.log('API Error:', {
                url: error.config?.url,
                method: error.config?.method,
                status: error.response?.status,
                detail: error.response?.data?.detail,
            });
        }

        if (error.response?.status === 401) {
            // Handled globally via AuthContext listener for reactive logout
            if (__DEV__) console.log('Unauthorized (401) detected. Redirecting to login via AuthContext.');
        }
        return Promise.reject(error);
    }
);

// ============ AUTH APIs ============

export const authAPI = {
    sendOTP: (phone, name, is_login = false, terms_accepted = false) => {
        const data = { phone, is_login, terms_accepted };
        if (name) data.name = name;
        return api.post('/auth/send-otp', data);
    },

    verifyOTP: (phone, otp, name, terms_accepted = false) => {
        const data = { phone, otp, terms_accepted };
        if (name) data.name = name;
        return api.post('/auth/verify-otp', data);
    },

    verifySDK: (phone, name, is_login = false, terms_accepted = false) => {
        const data = { phone, is_login, terms_accepted };
        if (name) data.name = name;
        return api.post('/auth/verify-sdk', data);
    },

    checkPhone: (phone) => api.get(`/auth/check-phone/${phone}`),

    getMe: () => api.get('/auth/me'),

    switchRole: (role) => api.post('/auth/switch-role', { role }),

    updateProfile: (data) => api.put('/auth/me', data),

    // Profile Photo methods
    uploadProfilePhoto: (photoBase64) => api.post('/auth/me/photo', { photo: photoBase64 }, { timeout: 60000 }),
    removeProfilePhoto: () => api.delete('/auth/me/photo'),

    // Security & Privacy
    getSessions: () => api.get('/auth/sessions'),
    requestDataExport: () => api.post('/auth/request-data-export'),
    resetPIN: () => api.post('/auth/reset-pin'),
    logout: () => api.post('/auth/logout'),
    logoutAllSessions: () => api.post('/auth/logout-all'),
    deleteAccount: () => api.delete('/auth/me'),
};

// ============ SHOP APIs ============

export const shopAPI = {
    // Get all shops owned by current user
    getAll: () => api.get('/shops'),

    // Create a new shop
    create: (data) => api.post('/shops', data),

    // Get shop dashboard data
    getDashboard: (shopId) => api.get(`/shops/${shopId}/dashboard`),

    // Get shop by code (public)
    getByCode: (shopCode) => api.get(`/shops/public/${shopCode}`),

    // Update shop details
    update: (shopId, data) => api.put(`/shops/${shopId}`, data),

    // Connect customer to shop (public)
    connectToShop: (shopCode, customerData) =>
        api.post(`/shops/public/${shopCode}/connect`, customerData),
};

// ============ LOCATION APIs ============
export const locationAPI = {
    // Get location details by proxying through our robust python backend
    getByPincode: (pincode) => api.get(`/location/pincode/${pincode}`),
};

// ============ CUSTOMER APIs (for shop owners) ============

export const customerAPI = {
    // Get all customers for a shop (optional params: { from_date, to_date })
    getAll: (shopId, params) => api.get(`/shops/${shopId}/customers`, { params }),

    // Add a customer to a shop
    create: (shopId, data) => api.post(`/shops/${shopId}/customers`, data),

    // Update customer details
    update: (shopId, customerId, data) =>
        api.put(`/shops/${shopId}/customers/${customerId}`, data),

    // Update service/staff calendar data and rate
    updateServiceData: (shopId, customerId, data) =>
        api.put(`/shops/${shopId}/customers/${customerId}/service_data`, data),

    // Get customer transactions (via shop transactions filtered by customer)
    getTransactions: (shopId, customerId) =>
        api.get(`/shops/${shopId}/transactions`).then(response => ({
            ...response,
            data: response.data.filter(t => t.customer_id === customerId)
        })),

    // Send push notification for payment request
    notifyPayment: (shopId, customerId, data) =>
        api.post(`/shops/${shopId}/customers/${customerId}/notify-payment`, data),

    // Send verification link
    sendVerification: (shopId, customerId) =>
        api.post(`/shops/${shopId}/customers/${customerId}/send-verification`),

    // Get notifications sent by the shop
    getNotifications: (shopId) => api.get(`/shops/${shopId}/notifications`),

    // Get a specific customer
    getById: (shopId, customerId) => api.get(`/shops/${shopId}/customers/${customerId}`),

    // Get notification history for a specific customer
    getCustomerNotifications: (shopId, customerId) =>
        api.get(`/shops/${shopId}/customers/${customerId}/notifications`),

    // Explicitly verify customer (via deep link or browser)
    verifyCustomer: (customerId) =>
        api.post(`/public/verify-customer/${customerId}`),
};

// ============ PRODUCT APIs ============

export const productAPI = {
    // Get all products for a shop
    getAll: (shopId) => api.get(`/shops/${shopId}/products`),

    // Create a product
    create: (shopId, data) => api.post(`/shops/${shopId}/products`, data),

    // Update a product
    update: (shopId, productId, data) =>
        api.put(`/shops/${shopId}/products/${productId}`, data),

    // Delete a product (soft delete)
    delete: (shopId, productId) =>
        api.delete(`/shops/${shopId}/products/${productId}`),
};

// ============ SERVICE APIs (Dedicated collection for delivery/cleaning services) ============

export const serviceAPI = {
    // Get all services for a shop
    getAll: (shopId) => api.get(`/shops/${shopId}/services`),

    // Create a service
    create: (shopId, data) => api.post(`/shops/${shopId}/services`, data),

    // Get a specific service
    getById: (shopId, serviceId) => api.get(`/shops/${shopId}/services/${serviceId}`),

    // Update service details
    update: (shopId, serviceId, data) =>
        api.put(`/shops/${shopId}/services/${serviceId}`, data),

    // Update service/staff calendar data and rate
    updateServiceData: (shopId, serviceId, data) =>
        api.put(`/shops/${shopId}/services/${serviceId}/service_data`, data),
        
    // Delete a service
    delete: (shopId, serviceId) =>
        api.delete(`/shops/${shopId}/services/${serviceId}`),

    // Send verification link
    sendVerification: (shopId, serviceId) =>
        api.post(`/shops/${shopId}/services/${serviceId}/send-verification`),

    // Send push notification for payment request
    notifyPayment: (shopId, serviceId, data) =>
        api.post(`/shops/${shopId}/services/${serviceId}/notify-payment`, data),

    // Get notification history for a specific service
    getCustomerNotifications: (shopId, serviceId) =>
        api.get(`/shops/${shopId}/services/${serviceId}/notifications`),
};

// ============ STAFF APIs (Dedicated collection for salaried/hourly staff) ============

export const staffAPI = {
    // Get all staff for a shop
    getAll: (shopId) => api.get(`/shops/${shopId}/staff`),

    // Create a staff member
    create: (shopId, data) => api.post(`/shops/${shopId}/staff`, data),

    // Get a specific staff member
    getById: (shopId, staffId) => api.get(`/shops/${shopId}/staff/${staffId}`),

    // Update staff details
    update: (shopId, staffId, data) =>
        api.put(`/shops/${shopId}/staff/${staffId}`, data),

    // Update staff service/attendance data
    updateServiceData: (shopId, staffId, data) =>
        api.put(`/shops/${shopId}/staff/${staffId}/service_data`, data),

    // Delete a staff member
    delete: (shopId, staffId) =>
        api.delete(`/shops/${shopId}/staff/${staffId}`),

    // Send verification link
    sendVerification: (shopId, staffId) =>
        api.post(`/shops/${shopId}/staff/${staffId}/send-verification`),
};

// ============ TRANSACTION APIs ============

export const transactionAPI = {
    // Get all transactions for a shop
    getAll: (shopId) => api.get(`/shops/${shopId}/transactions`),

    // Create a transaction
    create: (shopId, data) => api.post(`/shops/${shopId}/transactions`, data),
};

// ============ CUSTOMER DASHBOARD APIs (for customers viewing their ledger) ============

export const customerDashboardAPI = {
    // Get customer's ledger across all shops they're connected to
    getLedger: () => api.get('/customer/ledger'),
    // Get customer's notification history
    getNotifications: () => api.get('/customer/notifications'),
    // Send a push notification from the user to the shop owner
    notifyOwner: (shopId, data) => api.post(`/shops/${shopId}/notify-owner`, data),
};

// ============ ADMIN APIs ============

export const adminAPI = {
    // Get admin dashboard stats
    getDashboard: () => api.get('/admin/dashboard'),

    // Get all users
    getUsers: (search, skip = 0, limit = 100) =>
        api.get('/admin/users', { params: { search, skip, limit } }),

    // Get all shops
    getShops: (search, skip = 0, limit = 100) =>
        api.get('/admin/shops', { params: { search, skip, limit } }),

    // Get all transactions
    getTransactions: (skip = 0, limit = 100) =>
        api.get('/admin/transactions', { params: { skip, limit } }),

    // Update user status (verified/flagged)
    updateUserStatus: (userId, data) =>
        api.put(`/admin/users/${userId}`, data),

    // Assign/revoke admin roles
    assignRole: (userId, adminRoles, action) =>
        api.post('/admin/assign-role', {
            user_id: userId,
            admin_roles: adminRoles,
            action // 'grant' or 'revoke'
        }),

    // Promote user to super admin
    promoteToSuperAdmin: (userId) =>
        api.post(`/admin/promote-to-super-admin/${userId}`),

    // Get users for role assignment
    getUsersForRoleAssignment: () =>
        api.get('/admin/users-for-role-assignment'),

    // Get all customers/members (Admin view)
    getCustomers: (search, skip = 0, limit = 100, memberType = 'all') =>
        api.get('/admin/customers', { params: { search, skip, limit, member_type: memberType } }),
};

/**
 * Helper to extract error message from API response
 */
export const getAPIErrorMessage = (error) => {
    let message = 'An unexpected error occurred. Please try again.';

    if (error.response?.data?.detail) {
        // FastAPI standard error
        message = error.response.data.detail;
    } else if (error.response?.data?.message) {
        // Common fallback
        message = error.response.data.message;
    } else if (error.code === 'ECONNABORTED') {
        message = 'Request timed out. Please check your internet connection.';
    } else if (error.message === 'Network Error') {
        message = 'Network error. Please check your internet connection.';
    } else if (error.message) {
        // Network/Axios error - Strip "AxiosError: " or "Error: " prefixes
        message = error.message.replace(/^(AxiosError: |Error: )/i, '');
    }

    // Capitalize first letter if it's a message
    if (typeof message === 'string' && message.length > 0) {
        return message.charAt(0).toUpperCase() + message.slice(1);
    }

    return message;
};

export default api;

# 🏪 ShopMunimApp

A full-featured mobile application for managing shop-customer relationships — with dedicated interfaces for **Customers**, **Shop Owners**, and **Admins**. Built with React Native & Expo.

---

## 🛠️ Tech Stack & Dependencies

### Core Framework
- **React Native** (v0.81.5)
- **Expo SDK 54** (Managed Workflow)
- **React Navigation**: Multi-role navigation (Tabs & Stacks).

### Data & Networking
- **Axios**: HTTP client for backend REST API communication.
- **AsyncStorage**: Local persistent storage for JWT tokens and user preferences.

### Reporting & Media
- **Expo Print / Sharing / FileSystem**: PDF generation and file sharing.
- **XLSX**: Excel spreadsheet generation for reports.
- **react-native-view-shot**: Capture UI components as images (used for QR sharing).
- **react-native-qrcode-svg**: Dynamic QR code generation for shops.
- **Expo Image Picker / Manipulator**: Profile photo uploads and compression.

### UI & UX
- **Expo Linear Gradient**: Modern premium aesthetics.
- **DateTimePicker**: Native date pickers for filtering reports.
- **React Native SVG**: Vector graphics support.
- **Expo Haptics**: Micro-interactions and feedback.

### Push & Messaging
- **Expo Notifications / Device**: Firebase Cloud Messaging (FCM) integration for real-time alerts.

---

## 🏗️ Project Architecture

```text
Shopmunim-Frontend/
├── src/
│   ├── api/          # Axios instance & API endpoint definitions
│   │   └── index.js  # Main API configuration & Interceptors
│   ├── components/   # Reusable UI atoms (Buttons, Cards, Modals)
│   ├── context/      # Global state (AuthContext, ThemeContext)
│   ├── navigation/    # Role-based Tab & Stack configurations
│   ├── screens/      # Feature-specific pages (Admin, Owner, Customer)
│   ├── theme/        # Style tokens (Colors, Typography, Spacing)
│   └── utils/        # Helper functions & Logic
│       ├── helpers.js        # Data formatting & Validations
│       └── downloadHelper.js # PDF & Excel generation logic
├── assets/           # Static images & fonts
├── app.json          # Expo configuration
├── package.json      # Dependencies & Scripts
└── eas.json          # Android/iOS build profiles
```

---

## 📦 Prerequisites

- **Node.js** (v18+) - [Download](https://nodejs.org/)
- **Node Package Manager (npm)**
- **Android Studio** (for Emulator) or **Expo Go** (for Physical Device)

---

## 🚀 Installation & Setup

```bash
# Clone the repository
cd Shopmunim-Frontend

# 1. Install Dependencies
npm install

# 2. Run the Application
# For Android:
npm run android

# For Physical Device (Scan QR):
npx expo start
```

---

## 🌟 Features

### 🔐 Authentication
- Phone number + OTP based login
- Phone validation & OTP verification
- Role-based navigation (auto-redirects to Customer / Shop Owner / Admin)

---

### 👤 Customer Side

#### 📊 Dashboard
- Overview of connected shops and balances
- Pull-to-refresh for latest data

#### 📒 Ledger Tab
- View full transaction ledger per shop
- Summary stats (total credit, payments, balance)
- Expandable transaction details with product items

#### 💳 Payments Tab
- View payment history
- Track all payments made to shops

#### 📜 History Tab
- Complete transaction history (credits & payments)
- Color-coded entries (green = payment, red = credit)

#### 👤 Account Tab
- View profile info (name, phone, role)
- **Privacy & Security**:
  - **Security Health**: Dynamic score based on account verification and setup.
  - **Active Sessions**: View and logout all devices connected to your account.
  - **Data Export**: Request a signed PDF of all your transaction data.
  - **Notification Controls**: Toggle Push/Payment alerts individually.
- Role switch button (switch to Shop Owner / Admin if eligible)

---

### 🏪 Shop Owner Side

#### 🏠 Home Dashboard
- Shop stats overview (total customers, revenue, pending balance)
- Recent transactions list
- Quick action buttons
- Create new shop option

#### 📦 Products Management
- Add, edit, and delete products
- Product name, price, unit fields
- Toggle product active/inactive status
- Pull-to-refresh product list

#### 👥 Customers Management
- View all shop customers with balances
- Add new customer (by phone number)
- Search customers by name
- Customer cards with balance status (color-coded: green/red/neutral)
- Tap customer to view detailed transactions

#### 📋 Customer Detail Screen
- Customer info header with balance display
- Transaction history with filters (All / Credits / Payments)
- Add new transaction (credit or payment)
- Send UPI payment link
- Send payment request via WhatsApp

#### 💰 Add Transaction Modal
- Select transaction type (Credit / Payment)
- Pick products from product list
- Enter quantity and amount
- Add optional note
- Auto-calculate totals

#### 📊 Transactions Tab
- View all shop transactions
- Transaction cards with customer name, amount, date

#### 📱 QR Code & Sharing
- Auto-generated QR code for shop
- Share QR code image
- Download QR code
- Copy shop link to clipboard
- Share via WhatsApp / QR Code image
- **Customer Verification**: Generate and send deep links for identity verification.

#### 👤 Account Tab
- Shop info & owner details
- Role switch (switch to Customer / Admin)
- Shop settings

---

### 🔐 Admin Panel

#### 📊 Admin Dashboard
- Overview stats (total users, shops, transactions, revenue)
- Stat cards with icons and colors
- Pull-to-refresh

#### 👥 User Management
- Paginated user table (searchable)
- View user details (name, phone, role, status, join date)
- Verify / Unverify users
- Flag / Unflag users
- Role badges with colors

#### 🏪 Shop Management
- Paginated shop list (searchable)
- Shop cards with category badges
- View shop details (name, owner, category, customers, revenue)

#### 🛒 Customer Management
- View all customers across all shops
- Search by customer name or shop name
- Filter by shop
- Customer cards with balance, transaction count
- Stats cards (total customers, total balance, active shops)
- Tap customer → opens detailed transaction view

#### 📋 Admin Customer Detail Screen
- Customer info (name, phone, balance, status)
- Purchase analytics (total transactions, credits, payments, items purchased)
- Transaction history with filters:
  - **Date range filter** with "Set" & "Clear" buttons
  - **Type filter** — All / Credits / Payments
- **PDF Export** — Styled admin report:
  - Header with lock icon & admin badge
  - Shop & customer info sections
  - Analytics summary boxes
  - Color-coded transaction table
  - Filename: `{customer_name}.pdf`
- **Excel Export** — `.xlsx` file:
  - Header rows (Shop, Customer, Report Generated date)
  - Transaction table (Date, Type, Items, Quantity, Amount, Note)
  - Filename: `{customer_name}.xlsx`

#### 👥 Role Management
- Search users by name or phone
- **Show Test Users** toggle (hides default "User" named accounts)
- User cards with role badges:
  - 🛡️ **Admin** — Blue solid badge with shield icon (View only)
  - 🏅 **Super Admin** — Amber solid badge with ribbon icon (Full management)
  - 🏪 **Shop Owner** — Green outlined badge with storefront icon
  - 🛒 **Customer** — Orange outlined badge with cart icon
  - ✅ **Verified** — Green solid badge with checkmark icon
- **Manage Roles** modal:
  - **Super Admin**: Can grant/revoke admin access and promote users.
  - **Admin**: Can view current roles but management actions are disabled.
- **Role Management Guidelines** card with usage instructions

#### 🧭 Admin Bottom Navigation
- Home | Users | Shops | Customers | Roles | Logout

---

## ⚡ Commands

| Command | Description |
|---------|-------------|
| `npm run android` | Run on Android |
| `npx expo start --android` | Run on Android emulator |
| `npx expo start --android --clear` | Clear cache and run |

---

## 🐛 Troubleshooting

### Metro Bundler Issues
```bash
npx expo start --android --clear
```

### Module Not Found
```bash
rm -rf node_modules
npm install
```

### Connection Failed
- Ensure phone and computer on same WiFi
- Try: `npx expo start --tunnel`

---

## 📡 Backend Integration

The app connects to the **ShopMunim Backend** (FastAPI) for all data operations.

### Configuration
Update the API base URL in `src/api/index.js` (or equivalent) to point to your backend:
- **Development**: `http://10.0.2.2:8000` (for Android Emulator)
- **Production**: `https://shopmunim-backend.onrender.com`

---

## 👨‍💻 Author

Developed with ❤️ for ShopMunim

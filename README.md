# Property Journal v2.0 — The CarFax for Your House™

Complete, production-ready Expo SDK 54 app with authentication, real PDF generation,
file uploads, push notifications, onboarding, legal pages, and AI assistant.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start Expo Go dev server
npx expo start

# Scan QR with Expo Go, or press 'i' for iOS simulator / 'a' for Android emulator
```

### Demo Account
Email: `demo@homewise.app`
Password: `demo1234`

Or tap **"Use demo account"** on the sign-in screen.

---

## What's Built

### Authentication
- Sign In / Sign Up with email + password
- Full form validation
- Persistent sessions (survives app restart)
- Change password (working, validates current password)
- Edit profile (name, phone)
- Sign out with confirmation

### Onboarding
- 3-step flow: Welcome → Add First Property → Features → Notifications
- Shown once per account, never again
- Skippable property step

### Screens (6 tabs + extras)
| Screen | Status |
|---|---|
| **Home Dashboard** | ✅ Property hero, Health Score ring, Quick Actions, Tasks, Alerts, Score Breakdown, Recent data |
| **Properties** | ✅ Multi-home CRUD, score rings per property, full add form |
| **Maintenance** | ✅ 5 tabs: Schedule · Repairs · Appliances · Paint · Contractors — all fully functional |
| **Vault** | ✅ Document storage with real file picker (PDFs, images), share via OS sheet, category filters |
| **Reports** | ✅ Health Score gauge + real PDF generation via expo-print, share sheet |
| **Profile** | ✅ Edit profile, change password, notification toggles, Terms/Privacy links, sign out |
| **AI Assistant** | ✅ Claude-powered chat with full property context |
| **Photo Gallery** | ✅ Camera + library picker, grid view, full-screen viewer, captions, categories, delete |
| **Onboarding** | ✅ 3-step first-run flow |
| **Sign In / Sign Up** | ✅ Full working auth |
| **Terms of Service** | ✅ Real legal content |
| **Privacy Policy** | ✅ Real legal content |

### Features
- 🏠 Home Health Score™ (0–100) computed from real data
- 📊 Score breakdown: Maintenance, Appliances, Repairs, Warranty, Inspections
- 🏅 Property Journal Certified™ badge (score ≥ 85)
- 📄 Real PDF generation with expo-print (professional branded layout)
- 📱 Real file upload — PDFs and images stored locally via expo-document-picker
- 📸 Camera + photo library via expo-image-picker
- 🔔 Local push notifications — maintenance reminders + warranty alerts (expo-notifications)
- 💾 AsyncStorage persistence — all data survives app restart
- 🔐 Working auth — sign in/up/out, change password, edit profile
- 📋 Terms of Service — real content, inline in app
- 🔒 Privacy Policy — real content, inline in app
- 🤖 AI assistant — Claude Sonnet with full property context injected
- 📱 Onboarding flow — shown once per account

---

## Architecture

```
homewise/
├── app/
│   ├── _layout.tsx            # Root: AuthProvider + HomeWiseProvider + AuthGate
│   ├── ai.tsx                 # AI Assistant (Claude API)
│   ├── auth/
│   │   ├── sign-in.tsx        # Sign in screen
│   │   └── sign-up.tsx        # Sign up screen
│   ├── onboarding/
│   │   └── index.tsx          # 3-step onboarding
│   ├── legal/
│   │   ├── privacy.tsx        # Privacy Policy
│   │   └── terms.tsx          # Terms of Service
│   ├── vault/
│   │   └── photos.tsx         # Photo gallery
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx          # Home Dashboard
│       ├── properties.tsx
│       ├── maintenance.tsx    # 5-tab screen
│       ├── vault.tsx          # Document vault
│       ├── reports.tsx        # PDF reports
│       └── profile.tsx        # Settings
├── components/
│   ├── Card.tsx
│   ├── Screen.tsx
│   ├── Header.tsx
│   ├── ScoreRing.tsx
│   └── EmptyState.tsx
├── constants/
│   └── theme.ts               # Full design system
├── context/
│   ├── HomeWiseContext.tsx    # App data + CRUD + score computation
│   └── AuthContext.tsx        # Auth state + sign in/up/out
├── data/
│   └── demoData.ts            # Pre-loaded demo property
└── lib/
    ├── fileUtils.ts           # Image picker, document picker, file management
    ├── notifications.ts       # Push notification scheduling
    ├── pdfGenerator.ts        # expo-print PDF generation
    └── seedDemo.ts            # Seeds demo@homewise.app account on first launch
```

---

## For App Store Submission

### Steps remaining before submission:
1. Replace `YOUR_EAS_PROJECT_ID` in `app.json` with your actual EAS project ID
2. Run `eas build --platform ios --profile production`
3. Fill in `eas.json` with your Apple ID, App Store Connect App ID, and Team ID
4. Create App Store listing (screenshots, description, keywords)
5. Submit: `eas submit --platform ios`

### App Store requirements covered:
- ✅ Privacy Policy (inline in app + URL in app.json)
- ✅ Terms of Service (inline in app)
- ✅ Camera usage description
- ✅ Photo library usage description
- ✅ Notification usage
- ✅ Sign in / Sign out
- ✅ No placeholder/stub screens shown to users
- ✅ `eas.json` build config

### Still needed for production scale:
- Supabase Auth (replace AsyncStorage auth for multi-device sync)
- Supabase Storage (replace local file storage for cross-device access)
- RevenueCat (in-app subscriptions for Premium plan)
- Sentry (crash reporting)
- Apple Sign In (required if any social login is offered)

---

*Property Journal™ — The CarFax for Your House*
*© 2026 Property Journal*

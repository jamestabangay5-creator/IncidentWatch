# SafeTrace

**SafeTrace** is a secure, blockchain-backed incident reporting platform for citizens and officials. Every report is sealed with a SHA-256 hash chain for tamper-evidence, pinned on an interactive geospatial map, and managed through a role-based admin dashboard with real-time updates.

---

## Features

### Citizen (User) Side
- **Submit incident reports** — choose incident type, date, description, optional photo, and pin the exact location on a live map
- **Blockchain sealing** — every report is hashed (SHA-256) and chained to the previous record, making history tamper-evident
- **My Reports** — view all submitted reports with status badges, inline photo viewer with lightbox, and blockchain hash
- **Navigation buttons** — one-tap Google Maps directions or map view for each report location
- **Real-time notifications** — instant bell alerts when an admin updates a report status

### Admin Side
- **Manage Reports** — live-updating list of all reports via Firestore real-time listener
- **Status workflow** — enforced transition rules: `Pending → Verified → Resolved` or `Pending/Verified → Rejected`. Terminal states (Resolved, Rejected) cannot be changed
- **Hotspot Map** — interactive Leaflet heatmap showing all incident locations with rich popups (description, date, photo, Navigate + View map buttons)
- **User Management** — activate/deactivate citizen accounts; admin accounts are protected from deactivation
- **PDF Export** — export filtered reports to PDF with a custom date range picker
- **Admin Notifications** — real-time bell alerts when new reports are submitted by citizens

### Platform
- **Role-based access control** — `admin` and `user` roles stored in Firestore, enforced on both frontend routes and Firestore security rules
- **Responsive UI** — mobile-first design with hamburger menu, card layouts on small screens, and table layouts on desktop
- **Hamburger navigation** — z-index correctly layered above Leaflet maps so the menu is always accessible

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Router, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend / Database | Firebase Firestore |
| Authentication | Firebase Auth (Email/Password) |
| File Storage | Base64 in Firestore (no CORS issues) |
| Maps | Leaflet, react-leaflet, leaflet.heat |
| Blockchain | SHA-256 via Web Crypto API (client-side) |
| PDF Export | jsPDF + jsPDF-autotable |
| Build Tool | Vite 7 |
| Notifications | Firestore `onSnapshot` real-time listener |

---

## Project Structure

```
src/
├── components/
│   ├── AppHeader.tsx        # Sticky nav with hamburger menu + notification bell
│   ├── HotspotMap.tsx       # Leaflet map with heatmap overlay and rich popups
│   ├── MapPicker.tsx        # Interactive location picker with address search
│   └── RequireAuth.tsx      # Route guard for auth + admin role
├── hooks/
│   ├── useAuth.tsx          # Firebase Auth context + role fetching
│   └── useNotifications.tsx # Real-time Firestore notification listener
├── integrations/
│   └── firebase/
│       └── client.ts        # Firebase app, auth, db, storage init
├── lib/
│   ├── blockchain.ts        # SHA-256 hash chain builder
│   └── utils.ts
└── routes/
    ├── index.tsx            # Landing page
    ├── auth.tsx             # Sign in / Create account
    ├── dashboard.tsx        # User dashboard with report stats
    ├── reports.tsx          # My Reports list with lightbox image viewer
    ├── report.new.tsx       # Submit new report form
    ├── admin.index.tsx      # Admin dashboard + PDF export with date filter
    ├── admin.reports.tsx    # Manage all reports with status workflow
    ├── admin.map.tsx        # Hotspot heatmap
    └── admin.users.tsx      # User management (responsive cards + table)
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with **Firestore**, **Authentication (Email/Password)**, and **Storage** enabled

### Installation

```bash
git clone https://github.com/your-username/safetrace.git
cd safetrace
npm install
```

### Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication → Email/Password**
3. Create a **Firestore Database** (start in test mode, then apply rules below)
4. Copy your Firebase config into `src/integrations/firebase/client.ts`

### Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /profiles/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    match /user_role/{uid} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /reports/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    match /blockchain_logs/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
    match /notifications/{id} {
      allow read, update: if request.auth != null && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null;
    }
    match /audit_logs/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}
```

### Creating the Admin Account

1. Go to **Firebase Console → Authentication → Users → Add user**
   - Email: `admin@safetrace.local`
   - Password: *(your choice)*
   - ✅ Auto Confirm User — copy the generated UID

2. In **Firestore → SQL Editor**, create these documents:

   **`profiles/{uid}`**
   ```
   full_name: "System Administrator"
   email: "admin@safetrace.local"
   is_active: true
   created_at: (timestamp)
   ```

   **`user_role/{uid}`**
   ```
   roles: "admin"
   updated_at: (timestamp)
   ```

### Run Locally

```bash
npm run dev
```

App runs at `http://localhost:8080`

### Build for Production

```bash
npm run build
```

---

## Firestore Collections

| Collection | Purpose |
|---|---|
| `profiles` | User profile data (name, email, contact, active status) |
| `user_role` | Role assignments — document ID = Firebase Auth UID |
| `reports` | Incident reports with status, location, image (base64), blockchain hash |
| `blockchain_logs` | Append-only SHA-256 hash chain entries |
| `notifications` | User and admin notifications |
| `audit_logs` | Admin action history (status changes, user activation) |

---

## Status Workflow

```
Pending ──→ Verified ──→ Resolved (final)
   │              │
   └──────────────┴──→ Rejected (final)
```

Once a report reaches **Resolved** or **Rejected**, no further status changes are allowed.

---

## License

MIT — built as a capstone project.

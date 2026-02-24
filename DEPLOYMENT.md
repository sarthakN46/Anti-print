# XeroxSaaS Deployment & Architecture Guide

This document serves as a complete reference for the XeroxSaaS application, including its architecture, file structure, workflows, and a step-by-step guide for deploying it for free.

---

## 1. Project Overview
XeroxSaaS is a platform connecting users with local print shops. Users can upload documents, pay securely online, and pick up prints without waiting in line. Shops get a dashboard to manage orders, track revenue, and download files.

### Tech Stack
*   **Frontend:** React (Vite), TypeScript, Tailwind CSS, Socket.io-Client, Razorpay Web SDK.
*   **Backend:** Node.js, Express, TypeScript, Socket.io, MongoDB (Mongoose).
*   **Database:** MongoDB Atlas (Cloud).
*   **Storage:** S3-Compatible Object Storage (MinIO for local / Backblaze B2 or AWS S3 for Prod).
*   **Payment:** Razorpay (Test Mode integrated).
*   **Deployment:** Vercel (Frontend) + Render (Backend).

---

## 2. File Structure & Key Components

### Root Directory
*   `rzp-key.csv` - Contains Razorpay Test Credentials.
*   `README.md` - Basic setup info.

### Backend (`/backend`)
Handles API requests, database connections, and real-time socket events.

```text
backend/
├── src/
│   ├── config/
│   │   ├── db.ts           # MongoDB connection logic
│   │   └── s3.ts           # AWS SDK S3 client (handles Backblaze/MinIO connections)
│   ├── controllers/
│   │   ├── authController.ts   # Login/Register logic
│   │   ├── orderController.ts  # Create order, Razorpay verification, refunds
│   │   ├── shopController.ts   # Shop management, employee addition
│   │   └── uploadController.ts # File upload & conversion handling
│   ├── middlewares/
│   │   └── authMiddleware.ts   # JWT verification middleware
│   ├── models/
│   │   ├── Order.ts        # Mongoose Schema for Orders
│   │   ├── Shop.ts         # Mongoose Schema for Shops
│   │   └── User.ts         # Mongoose Schema for Users
│   ├── routes/             # API Route definitions
│   ├── services/
│   │   └── conversionService.ts # Logic to handle file processing
│   ├── utils/
│   │   ├── generateToken.ts # JWT Token generator
│   │   └── socket.ts        # Socket.io instance manager
│   └── server.ts           # Entry point: App setup, Middleware, & Server start
├── Dockerfile              # Container config (optional)
└── package.json            # Backend dependencies
```

### Frontend (`/frontend`)
The User and Shop interfaces.

```text
frontend/
├── src/
│   ├── components/
│   │   ├── FileUpload.tsx  # Drag-and-drop file uploader
│   │   ├── QRScanner.tsx   # QR Code reader for shop selection
│   │   └── ErrorBoundary.tsx # Global error handler
│   ├── context/
│   │   └── AuthContext.tsx # Global User State (Login/Logout/Role)
│   ├── pages/
│   │   ├── Landing.tsx     # Homepage with "Customer Care" link
│   │   ├── Login.tsx       # Auth page
│   │   ├── UserDashboard.tsx # MAIN User View: Map, Upload, Cart, Razorpay Checkout
│   │   ├── ShopDashboard.tsx # MAIN Shop View: Live Queue, Printing, Revenue
│   │   ├── ShopHistory.tsx   # Past orders view
│   │   ├── ShopSettings.tsx  # Shop configuration (Pricing, etc.)
│   │   └── Support.tsx       # Contact page (Call/Email)
│   ├── services/
│   │   └── api.ts          # Axios instance with base URL config
│   ├── App.tsx             # Route definitions & Protection logic
│   └── main.tsx            # App Entry point
└── package.json            # Frontend dependencies
```

---

## 3. Application Workflow

1.  **Registration:**
    *   Users register/login via `authController`.
    *   Shops register and set location/pricing via `shopController`.
2.  **Order Creation:**
    *   User selects a shop (Location/QR) on `UserDashboard`.
    *   User uploads files -> Uploads go to S3 Bucket (via `uploadController`).
    *   User configures print settings (Color, Copies).
3.  **Payment (Razorpay):**
    *   User clicks "Pay". Frontend calls `createPaymentOrder`.
    *   Razorpay Modal opens.
    *   **Success:** `verifyPayment` runs on backend. Order marked `PAID`. Socket notifies Shop.
    *   **Failure:** Order remains `CANCELLED`/`FAILED`.
    *   **Refund:** If Shop cancels a paid order, `cancelOrder` triggers Razorpay Refund API automatically.
4.  **Fulfillment:**
    *   Shop sees order on `ShopDashboard`.
    *   Shop clicks "Print" -> PDF preview opens.
    *   Shop marks "Completed". User gets notification.

---

## 4. Environment Variables Checklist

### Backend (`backend/.env`)
| Variable | Description |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Standard for Render) |
| `MONGO_URI` | MongoDB Atlas Connection String |
| `JWT_SECRET` | Secret key for signing tokens |
| `CLIENT_URL` | Frontend URL (e.g., `https://myapp.vercel.app`) - For CORS |
| `RAZORPAY_KEY_ID` | From Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | From Razorpay Dashboard |
| `MINIO_ENDPOINT` | Backblaze/S3 Endpoint (e.g., `https://s3.us-west-004.backblazeb2.com`) |
| `MINIO_BUCKET_NAME` | Unique bucket name |
| `MINIO_ACCESS_KEY` | Backblaze Key ID |
| `MINIO_SECRET_KEY` | Backblaze Application Key |
| `S3_FORCE_PATH_STYLE` | `false` (For AWS/Backblaze), `true` (For local MinIO) |

### Frontend (`frontend/.env`)
| Variable | Description |
| :--- | :--- |
| `VITE_API_URL` | Backend URL (e.g., `https://myapp.onrender.com`). No trailing slash. |

---

## 5. Free Tier Deployment Guide (Step-by-Step)

### Phase 1: Database (MongoDB Atlas)
1.  Register at **MongoDB Atlas**. Create a **Free Shared Cluster (M0)**.
2.  Create a Database User (`admin` / `password`).
3.  **Network Access:** Allow `0.0.0.0/0` (Access from Anywhere).
4.  **Connect:** Get the driver connection string: `mongodb+srv://admin:<password>@cluster0...`.

### Phase 2: Storage (Backblaze B2)
1.  Register at **Backblaze B2**.
2.  Create a **Private Bucket** (e.g., `xerox-files-prod`).
3.  Go to **App Keys** -> Add New Key -> Allow access to bucket.
4.  **COPY** the `keyID` and `applicationKey` immediately.
5.  Copy the **Endpoint** from the Bucket settings (e.g., `s3.us-west-004.backblazeb2.com`).

### Phase 3: Backend (Render)
1.  Push code to **GitHub**.
2.  Register at **Render.com**. New **Web Service**.
3.  Connect GitHub Repo.
4.  **Root Directory:** `backend`.
5.  **Build Command:** `npm install && npm run build`.
6.  **Start Command:** `npm start`.
7.  **Environment Variables:** Add all variables listed in Section 4 (Backend).
    *   *Note:* Ensure `MINIO_ENDPOINT` starts with `https://`.
8.  Deploy. Copy the `onrender.com` URL.

### Phase 4: Frontend (Vercel)
1.  Register at **Vercel.com**.
2.  **Add New Project** -> Import GitHub Repo.
3.  **Root Directory:** Edit -> Select `frontend`.
4.  **Environment Variables:**
    *   `VITE_API_URL` = Your Render Backend URL.
5.  Deploy. Copy the `vercel.app` URL.

### Phase 5: Final Link
1.  Go back to **Render** -> Environment.
2.  Add `CLIENT_URL` = Your Vercel Frontend URL.
3.  Redeploy Backend.

**Success!** Your XeroxSaaS platform is now live.

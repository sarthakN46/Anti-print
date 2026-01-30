# XeroxSaaS - Print Shop Management & Student Portal

A full-stack application connecting students with local print shops for seamless document printing.

## 🚀 Features

*   **For Students:**
    *   Find shops nearby (List or Map view).
    *   Upload documents (PDF, Doc, PPT, Images).
    *   Configure print settings (Color/B&W, Single/Double, Copies).
    *   Real-time order status updates.
    *   Secure mock payments.
*   **For Shops:**
    *   Real-time dashboard for incoming orders.
    *   Document preview and printing.
    *   Employee management.
    *   Custom pricing configuration (including Bulk Discounts).
    *   Status toggle (Open/Closed).

## 🛠️ Tech Stack

*   **Frontend:** React, Vite, TypeScript, TailwindCSS, Socket.io-client, React Leaflet.
*   **Backend:** Node.js, Express, MongoDB, Socket.io, AWS SDK (MinIO/S3).
*   **Storage:** MinIO (S3 Compatible).

## ⚡ Quick Start

### Prerequisites
*   Node.js (v18+)
*   MongoDB (running locally or URI)
*   MinIO (running locally on port 9000)

### 1. Backend Setup
```bash
cd backend
npm install
# Ensure .env is set (already created)
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Usage
*   Open `http://localhost:5173`
*   **Register Shop:** Create a shop account, set up your location and pricing.
*   **Register Student:** Create a student account to browse shops and place orders.

## 📝 Notes
*   **Maps:** The map defaults to India/Global view. Browser geolocation is used to sort shops.
*   **Storage:** Ensure MinIO is running (`minio server ./data`) or update `.env` to point to a real S3 bucket.

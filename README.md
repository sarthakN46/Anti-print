# XeroxSaaS - The Ultimate Print Shop Management & Student Portal 🖨️🚀

XeroxSaaS is a full-stack, real-time platform designed to bridge the gap between students needing document printing and local print shops. It streamlines the entire printing process—from document upload and configuration to payment and secure pickup—using modern web technologies.

## 🌟 The Problem & Our Solution
**The Problem:** Students often face long queues at local print shops, struggling with USB drives, WhatsApp document transfers, and unclear pricing. Shop owners struggle to manage peak hours, keep track of incoming digital files, and calculate complex bulk pricing manually.

**The Solution:** XeroxSaaS provides a centralized platform where:
- **Students** can find nearby shops, upload documents remotely, configure print settings, pay securely, and track their order status in real-time.
- **Shop Owners** get a dedicated dashboard to receive organized orders, automatically calculate costs, print documents with one click, and manage their workflow efficiently.

---

## ✨ Key Features

### 🎓 For Students (Users)
*   **Location-Based Shop Discovery:** Find shops nearby using an interactive Map (Leaflet) or List view.
*   **Remote Document Upload:** Upload PDFs, Word documents, PPTs, and images directly to secure cloud storage.
*   **Advanced Print Configuration:** Customize print settings per document (Color/B&W, Single/Double-sided, Number of Copies).
*   **Real-Time Status Tracking:** Watch your order move from "Queued" to "Printing" to "Ready" via WebSockets.
*   **Secure Payments & Pickup:** Pay online via Razorpay. Receive a unique 4-digit code and QR code for secure document pickup at the shop.

### 🏪 For Print Shops (Owners & Staff)
*   **Live Order Dashboard:** Receive instant notifications for new orders without refreshing the page.
*   **One-Click Printing:** Preview and print standardized PDFs directly from the browser using `print-js`.
*   **Custom Pricing Engine:** Configure base rates and bulk discount thresholds (e.g., cheaper rates for >100 pages).
*   **QR Code Verification:** Use the built-in camera scanner to scan a student's QR code and securely hand over the documents.
*   **Shop Status Toggle:** Easily switch between "Open" and "Closed" to pause incoming orders during busy times.
*   **Employee Management:** Create staff accounts with limited access to help manage the workload.

---

## 🛠️ Tech Stack: What We Used & Why

We chose a robust, scalable **MERN** stack (MongoDB, Express, React, Node.js) enhanced with real-time and cloud storage capabilities.

### Frontend (User Interface)
*   **React 19 & Vite:** For building a lightning-fast, component-based Single Page Application.
*   **TypeScript:** To ensure type safety, reducing runtime errors and improving developer experience.
*   **Tailwind CSS:** For rapid, responsive, and highly customizable styling.
*   **React Leaflet:** To render interactive maps for shop discovery.
*   **Socket.io-Client:** To receive live order updates from the server.
*   **print-js:** To handle cross-browser, silent (or semi-silent) PDF printing from the shop dashboard.
*   **html5-qrcode:** For scanning secure pickup QR codes via the device camera.

### Backend (API & Business Logic)
*   **Node.js & Express:** Lightweight and scalable server framework.
*   **TypeScript:** Enforcing strict data contracts across the API.
*   **MongoDB & Mongoose:** A flexible NoSQL database perfectly suited for complex, nested data like print configurations and varying pricing models.
*   **Socket.io:** Facilitating real-time bidirectional event broadcasting (e.g., `new_order`, `order_status_updated`).
*   **AWS SDK (S3 / MinIO):** For secure, scalable object storage. We stream file uploads directly to storage using `multer-s3` to minimize server memory usage.
*   **Razorpay:** Secure payment gateway integration for mock/real transactions.
*   **Node-Cron:** To automate database and storage cleanup (deleting orphaned files and old orders).

---

## ⚙️ How It Works: System Architecture & Workflow

Here is a step-by-step breakdown of what happens when a user places an order:

1.  **Authentication & Discovery:** The user logs in via Google OAuth or Email/Password (JWT). They view the map, and the frontend fetches shops from MongoDB based on their geolocation.
2.  **Direct-to-Cloud Upload:** The user uploads a file. The React frontend sends it to the Node.js backend, which uses `multer-s3` to pipe the file directly into our S3/MinIO bucket. The server responds with a unique `storageKey`.
3.  **Print Configuration & Cost Calculation:** The user selects "Color", "Double-Sided", etc. The frontend calculates the estimated cost based on the specific shop's `pricing` schema (including bulk discounts).
4.  **AI Document Standardization (Agent Layer):** 
    *   *Behind the scenes*, a specialized service converts non-PDF files (Word, PPT, Images) into standardized PDFs and calculates exact page counts to finalize the price.
5.  **Payment & Order Creation:** The user pays via Razorpay. Upon success, an `Order` document is saved in MongoDB.
6.  **Real-Time Broadcast:** The backend triggers `socket.emit('new_order')` specifically to the Room ID of the chosen shop. The shop dashboard instantly chimes and displays the new order.
7.  **Fulfillment & Secure Pickup:** 
    *   The shop owner previews the PDF, clicks "Print", and marks the order as "Ready".
    *   This status change is emitted back to the user via Socket.io.
    *   The user arrives, shows their unique QR code, the shop scans it, and the order is marked "Completed".
8.  **Automated Cleanup:** Every 24 hours, a `node-cron` job scrubs the S3 bucket and database to remove unlinked files or old completed orders, saving storage costs.

---

## 🗄️ Database Structure Overview

We utilize a dual-layer approach:
*   **MongoDB:** 
    *   `User`: Stores credentials, roles (`USER`, `OWNER`, `EMPLOYEE`), and OAuth IDs.
    *   `Shop`: Stores location (GeoJSON), status, and the dynamic `pricing` object.
    *   `Order`: The core junction. Stores references to the User, Shop, an array of `items` (with file keys, page counts, print configs), and `paymentStatus`.
*   **S3 / MinIO:** 
    *   Stores actual binary files organized securely by `{Shop_ID}/{User_ID}/{Filename}.{ext}`.

---

## 🚀 How to Run This Project Locally

Follow these steps to set up XeroxSaaS on your local machine.

### Prerequisites
*   **Node.js** (v18 or higher)
*   **MongoDB** (running locally or a MongoDB Atlas URI)
*   **MinIO** (for local S3-compatible storage) running on port 9000

### 1. Storage Setup (MinIO)
If you don't have an AWS S3 account, install MinIO locally:
```bash
# Start MinIO server
minio server ./data
```
*   Open the MinIO console (usually `http://localhost:9001`).
*   Create a bucket named `xeroxsaas` (or your preferred name).
*   Create Access Keys and note them down for the backend `.env` file.

### 2. Backend Setup
```bash
cd backend
npm install

# Create a .env file based on environment requirements (see below)
# Start the development server
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Create a .env file (e.g., VITE_API_URL=http://localhost:5000)
# Start the Vite development server
npm run dev
```

### 4. Usage
*   Open your browser and navigate to `http://localhost:5173`.
*   **Shop Registration:** Go to "Register Shop" to create an owner account, set up your shop's map location, and define pricing.
*   **Student Registration:** Create a user account to browse the map, select your shop, and place test orders!

---

## 🔐 Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/xeroxsaas
JWT_SECRET=your_super_secret_jwt_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id

# S3 / MinIO Configuration
AWS_ACCESS_KEY_ID=your_minio_access_key
AWS_SECRET_ACCESS_KEY=your_minio_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=xeroxsaas
S3_ENDPOINT=http://127.0.0.1:9000  # Only needed if using local MinIO

# Razorpay (Test Keys)
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

---

## 🔮 Future Improvements & Roadmap
*   **Push Notifications:** Integrate Web Push API or Firebase Cloud Messaging for offline order updates.
*   **Analytics Dashboard:** Add beautiful charts (using Recharts or Chart.js) for shop owners to visualize revenue trends over time.
*   **Automated Print Spooler:** A native desktop app for print shops that bypasses the browser print dialog entirely.
*   **Delivery Integration:** Partner with local delivery services (like Dunzo/Swiggy) to deliver printed documents directly to dorm rooms.

---
*Built with ❤️ for students and local businesses.*
# System Architecture & Workflow

The XeroxSaaS project follows a modern microservices-inspired architecture, emphasizing scalability, real-time communication, and secure document handling.

## 🏗️ Architecture Layers

### 1. Presentation Layer (Frontend)
Built with **React**, **Vite**, and **Tailwind CSS**. It communicates with the backend via RESTful APIs and maintains a persistent WebSocket connection for real-time order updates.

### 2. Application Layer (Backend API)
Built with **Node.js** and **Express**. It handles:
- **Authentication**: JWT-based session management and Google OAuth.
- **Business Logic**: Processing orders, shop registrations, and payments.
- **WebSocket Integration**: Push notifications for shops and users.
- **File Management Middleware**: Intermediary for S3/MinIO uploads.

### 3. AI Agent Layer (Assumption)
A dedicated service built with **LangChain**. It's responsible for:
- **Intelligent Document Conversion**: Converting various document formats (Word, PPT, Images) into standardized, high-quality PDFs.
- **Precise Page Count Calculation**: Using computer vision or internal document structure analysis to determine the exact page count for pricing calculations.

### 4. Data Layer (Persistence & Storage)
- **MongoDB**: Stores structured data about users, shops, and orders.
- **S3 / MinIO Bucket**: Stores the actual document files (both original and converted).

---

## 🔄 System Workflow

### 1. User Registration & Shop Discovery
- Users sign up via Google OAuth or standard registration.
- They can browse a map of available print shops nearby using **Leaflet**.
- Shop owners register their shops, providing locations and custom pricing.

### 2. Document Upload & Configuration
- Users select a shop and upload their documents (PDF, Word, etc.).
- The frontend uses **Multer-S3** to stream files directly to the storage bucket.
- Users configure their print settings (color, sides, copies, paper size).

### 3. AI Processing (LangChain Agent)
- Once an order is initiated, the **LangChain AI Agent** is triggered.
- It downloads the document from S3.
- It performs a specialized conversion into a printable PDF.
- It calculates the final page count, which is then used to update the total price.

### 4. Payment & Order Creation
- The user completes the payment via the **Razorpay** checkout.
- Upon successful payment, an order is created in MongoDB with a unique **pickup code**.
- The backend emits a `new_order` event via **Socket.io** to the specific shop.

### 5. Shop Processing & Real-time Updates
- The shop owner sees the new order on their dashboard.
- They can download the standardized PDF and print it using **print-js**.
- As the shop updates the order status (e.g., "Printing", "Ready"), the user receives instant updates.

### 6. Secure Pickup
- The user arrives at the shop and shows their **QR code** (containing the pickup code).
- The shop owner scans the QR code using the **html5-qrcode** scanner.
- Once verified, the order is marked as "Completed".

### 7. Automated Maintenance
- A **cron job** runs periodically to identify and remove old or expired files from the S3 bucket and MongoDB, ensuring the system remains efficient and cost-effective.

---
*Back to [Overview](./README.md)*

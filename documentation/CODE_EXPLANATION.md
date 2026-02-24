# Code Logic & AI Agent

This document explains the core logic behind the XeroxSaaS platform, focusing on the order fulfillment process and the specialized LangChain-based AI agent.

## 🚀 The Print Workflow

### 1. Document Upload & Storage
The file upload is handled by the `uploadRoutes.ts`. It uses **Multer** and **Multer-S3** to stream files directly into the S3 bucket without loading the entire file into the server's memory.
- **`fileHash`**: A SHA-256 hash is generated for each uploaded file to handle document batching and avoid redundant processing of the same file.

### 2. Order Initiation & AI Processing
When a user confirms their print settings, the `orderRoutes.ts` is triggered. Before the order is finalized, the **LangChain Document Agent** is invoked to process the uploaded documents.

---

## 🤖 LangChain Document Agent (Assumption)

The AI agent is a core part of the system, designed to handle complex document processing tasks that traditional scripts might struggle with.

### Agent Responsibilities:
1.  **Standardized PDF Conversion**:
    The agent takes various source files (Word, PowerPoint, Images, Text) and uses a combination of formatting logic and conversion tools to produce a high-quality, standardized PDF.
2.  **Intelligent Page Counting**:
    Instead of simple metadata parsing, the agent uses a more robust approach. It analyzes the document's structure, fonts, and layout to provide an accurate page count, even for malformed files or those with complex formatting (e.g., hidden slides in PPTs).
3.  **Content Analysis & Error Detection**:
    The agent can identify potential issues like low-resolution images, layout overflows, or corrupted fonts, and flag them to the user before they pay for the print.

### Implementation Logic:
- **`conversionService.ts`**: This service acts as a bridge between the Express backend and the LangChain agent.
- **Workflow**:
  - The service identifies non-PDF files in a new order.
  - It triggers the **LangChain Agent**, passing the S3 file reference.
  - The agent downloads, processes, and re-uploads the standardized PDF to the `/converted/` folder in S3.
  - The agent returns the new `convertedKey` and the final `pageCount`.

---

## 💳 Payment & Security

### Razorpay Integration
- The `orderController.ts` initiates a payment request with **Razorpay**.
- Once the user completes the payment on the frontend, a webhook (or a direct verification call) updates the `paymentStatus` in MongoDB.

### Secure Pickup System
- A unique **4-digit pickup code** is generated for each order.
- The frontend converts this code into a **QR code**.
- The shop owner's dashboard includes a **QR scanner** (using `html5-qrcode`) that verifies the code against the database.
- Once matched, the order's `orderStatus` is set to `COMPLETED`.

---

## 📢 Real-time Communication (Socket.io)

### Namespaces & Rooms:
- **Shop Rooms**: Each shop has its own unique room ID. When a new order is paid for, the backend emits a `new_order` event to that room.
- **User Rooms**: Each user has a room to receive updates on their specific orders.
- **Events**:
  - `new_order`: Triggered for shops upon successful payment.
  - `order_status_updated`: Triggered for users when a shop updates the status (e.g., from "Printing" to "Ready").

---

## 🧹 Automated Cleanup Logic

The `cron.ts` script runs a scheduled job using **Node-Cron** every 24 hours.
- It identifies files in S3 that were uploaded but never linked to a completed order within 48 hours.
- It removes "completed" orders and their associated files from the storage bucket to maintain a lean and cost-efficient system.

---
*Back to [Overview](./README.md)*

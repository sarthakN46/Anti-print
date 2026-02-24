# Tech Stack & Dependencies

The XeroxSaaS project is built using a modern, scalable, and type-safe tech stack. This document details all the core technologies and libraries used in both the backend and frontend.

## 🏗️ Backend

The backend is built with **Node.js** and **TypeScript**, using **Express** as the web framework. It follows a modular structure with controllers, routes, and services.

### Core Technologies
- **Node.js**: Server-side runtime environment.
- **Express**: Fast, unopinionated, minimalist web framework.
- **TypeScript**: Static typing for Node.js, ensuring code quality and better developer experience.
- **MongoDB & Mongoose**: NoSQL database for flexible and scalable data storage.
- **Socket.io**: Real-time bidirectional communication between server and clients.
- **AWS S3 / MinIO**: Scalable object storage for document uploads and converted PDFs.

### Key Dependencies
- **`aws-sdk`**: For interacting with AWS S3/MinIO buckets.
- **`jsonwebtoken` (JWT)**: Secure user authentication and authorization.
- **`bcryptjs`**: Password hashing for security.
- **`multer` & `multer-s3`**: Handling multi-part form data and direct file uploads to S3.
- **`razorpay`**: Payment gateway integration for online transactions.
- **`node-cron`**: Scheduled jobs for automatic cleanup and system maintenance.
- **`google-auth-library`**: Handling Google OAuth 2.0 for user login.
- **`helmet`**: Enhancing security by setting various HTTP headers.
- **`morgan`**: HTTP request logger middleware.

### AI Integration (Assumption)
- **`langchain`**: For building the AI agent that handles document conversion and page count logic.

---

## 🎨 Frontend

The frontend is a modern SPA (Single Page Application) built with **React** and **Vite**, utilizing **Tailwind CSS** for a responsive and clean UI.

### Core Technologies
- **React**: Component-based library for building user interfaces.
- **Vite**: Next-generation frontend tooling for fast builds and HMR.
- **TypeScript**: Type safety across the entire UI.
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development.

### Key Dependencies
- **`react-router-dom`**: Declarative routing for React applications.
- **`axios`**: Promise-based HTTP client for API requests.
- **`socket.io-client`**: Client-side library for real-time updates.
- **`lucide-react`**: Beautifully simple, pixel-perfect icons.
- **`leaflet` & `react-leaflet`**: Interactive maps for locating nearby shops.
- **`html5-qrcode` & `react-qr-code`**: QR code generation and scanning for secure pickups.
- **`react-hot-toast`**: Lightweight notifications for a better UX.
- **`jwt-decode`**: Decoding JWT tokens on the client side.
- **`print-js`**: Browser-side library for printing documents directly.

---

## 🛠️ Infrastructure & Tools
- **Docker**: Containerization for consistent development and deployment environments.
- **GitHub Actions (CI/CD)**: (Implicitly suggested) For automated builds and deployments.
- **Vercel / Render**: Platforms for hosting the frontend and backend.

---
*Back to [Overview](./README.md)*

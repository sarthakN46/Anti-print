# XeroxSaaS Documentation

Welcome to the official documentation for the **XeroxSaaS** project. This project is a comprehensive SaaS solution designed to streamline the process of document printing and management. It bridges the gap between users who need printing services and shop owners who provide them.

## Project Overview

XeroxSaaS is a full-stack application that allows:
- **Users**: To upload documents (PDF, Word, PPT, etc.), select printing preferences (B/W vs. Color, Single vs. Double sided, Paper Size), pay online via Razorpay, and track their order status in real-time.
- **Shop Owners**: To manage their shop profiles, set custom pricing for different types of prints, receive and manage incoming print orders, and update the status of orders from "Queued" to "Completed".
- **Real-time Interaction**: Both users and shops are notified of updates instantly via WebSockets (Socket.io).
- **Document Conversion**: Automatic conversion of non-PDF documents to printable PDFs using a specialized LangChain-based AI agent (Assumption).

## Key Features

- **Multi-Role Support**: User, Owner, and Employee roles with specific dashboards.
- **Smart File Management**: AWS S3/MinIO integration for secure and scalable document storage.
- **AI-Powered Conversion**: Integration of LangChain agents to handle complex document conversions and precise page count calculations.
- **Geolocation Services**: Users can find nearby print shops using an interactive map (Leaflet).
- **QR Code Workflow**: Unique pickup codes and QR scanners ensure secure document collection.
- **Automated Cleanup**: Scheduled cron jobs to remove expired or completed files, optimizing storage costs.

## Navigation

To explore further, please refer to the following documents:

1. [**Tech Stack & Dependencies**](./TECH_STACK.md): Detailed list of all technologies and libraries used.
2. [**System Architecture & Workflow**](./ARCHITECTURE.md): How the system is designed and how data flows through it.
3. [**Database Structure**](./DATABASE.md): Detailed breakdown of MongoDB schemas and S3 bucket organization.
4. [**Code Logic & AI Agent**](./CODE_EXPLANATION.md): Deep dive into the core business logic and the LangChain document agent.

---
*Last Updated: February 17, 2026*

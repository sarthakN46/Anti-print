# Database Structure

The XeroxSaaS project uses a dual-layer data storage approach: **MongoDB** for structured data and **AWS S3 / MinIO** for unstructured object storage.

## 💾 MongoDB (NoSQL)

The database consists of three primary collections: `User`, `Shop`, and `Order`.

### 👤 `User` Schema
Stores information about users, shop owners, and employees.
- **`name`** (String): Full name of the user.
- **`email`** (String, Unique): User's email address.
- **`role`** (Enum): `USER`, `OWNER`, or `EMPLOYEE`.
- **`googleId`** (String): OAuth ID for Google sign-in.
- **`password`** (String, Hidden): Hashed password for owners/employees.
- **`associatedShop`** (ObjectId, Ref: `Shop`): Link to the shop if the user is an owner or employee.

### 🏪 `Shop` Schema
Stores business details and complex pricing models.
- **`owner`** (ObjectId, Ref: `User`): Link to the shop's owner.
- **`name`** (String): Name of the printing shop.
- **`address`** (String): Physical address.
- **`location`** (GeoJSON Point): Coordinates for map-based discovery.
- **`image`** (String): URL of the shop's profile photo.
- **`status`** (Enum): `OPEN`, `CLOSED`, or `BUSY`.
- **`pricing`** (Object):
  - `bw` (Black & White): `single` and `double` sided prices.
  - `color`: `single` and `double` sided prices.
  - `bulkDiscount`: Enabled toggle, threshold (e.g., 100 pages), and special rates.
  - `otherSizes`: Custom pricing for A3, A2, and A1 paper sizes.

### 📦 `Order` Schema
The core collection linking users, shops, and documents.
- **`shop`** (ObjectId, Ref: `Shop`): Target shop for the print job.
- **`user`** (ObjectId, Ref: `User`): User who placed the order.
- **`items`** (Array of Objects):
  - `storageKey` (String): Unique ID of the original file in S3.
  - `originalName` (String): The name of the file as uploaded.
  - `fileHash` (String): SHA-256 hash for document batching.
  - `fileType` (String): The original file extension (e.g., `.docx`).
  - `pageCount` (Number): Total pages (calculated by the AI agent).
  - `convertedKey` (String): S3 key of the standardized PDF version.
  - `config` (Object): User preferences (color, sides, copies, paper size, orientation, page range).
  - `calculatedCost` (Number): Price for this specific document based on shop rates.
- **`totalAmount`** (Number): Total price including all items.
- **`paymentStatus`** (Enum): `PENDING`, `PAID`, `FAILED`, or `REFUNDED`.
- **`paymentId`** (String): Transaction ID from Razorpay.
- **`orderStatus`** (Enum): `QUEUED`, `PROCESSING`, `PRINTING`, `READY`, `COMPLETED`, or `CANCELLED`.
- **`pickupCode`** (String): A 4-digit security code for verification.

---

## 🪣 S3 Bucket Organization (Object Storage)

The storage bucket is organized hierarchically to ensure easy management and security.

### Folder Structure
Files are stored using the following key pattern:
`{Shop_ID}/{User_ID}/{Filename}.{ext}`

Example:
- `shop_123/user_456/resume.docx` (Original Upload)
- `shop_123/user_456/converted/resume.pdf` (Converted by AI Agent)

### Metadata & Lifecycle
- **Content-Type**: Appropriately set for each file (e.g., `application/pdf`).
- **Access Control**: Bucket is private, with access managed via pre-signed URLs or backend proxies.
- **Cleanup Policy**: Automated scripts periodically remove "orphan" files (uploaded but not ordered) and "completed" documents after a certain period.

---
*Back to [Overview](./README.md)*

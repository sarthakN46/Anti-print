# Anti-Print / XeroxSaaS — Codebase Map
> **AI Agent Navigation File** — Read this before making any changes. Do NOT read entire files every time.
> **Last Updated:** 2026-07-14

---

## Project Overview

**Anti-Print (XeroxSaaS)** is a SaaS platform for xerox/print shops in India.

- **Users** upload documents, select a nearby print shop, configure print options, pay via Razorpay, and pick up prints using a 4-digit code.
- **Shop Owners / Employees** manage incoming orders via a real-time dashboard, preview documents, and update order statuses.
- **Real-time** updates via Socket.io (new orders, status changes, notifications).
- **File Storage:** MinIO (local dev) / AWS S3 compatible (production)
- **File Conversion:** Python scripts convert DOCX/PPTX to PDF on the backend

---

## Root Structure

```
Anti-print/
+-- backend/               # Node.js + Express + TypeScript
+-- frontend/              # React + Vite + TypeScript + TailwindCSS
+-- docker-compose.yml     # MongoDB + Redis + MinIO containers
+-- render.yaml            # Render.com deployment config
+-- DEPLOYMENT.md
+-- DEPLOYMENT_GUIDE.md
+-- DEPLOYMENT_GUIDE_FREE.md
+-- rzp-key.csv            # Razorpay key info (local reference)
```

---

## BACKEND

### Entry Point
**`backend/src/server.ts`**
- Bootstraps Express app, connects DB, initializes Socket.io, registers all routes, starts cleanup cron
- Port: `process.env.PORT || 5000`
- CORS origin: `process.env.CLIENT_URL`
- Routes mounted at: `/api/auth`, `/api/shops`, `/api/upload`, `/api/orders`
- Socket.io rooms: `join_shop(shopId)`, `join_user(userId)`

### Environment Variables (backend/.env.example)
```
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=super_secret_jwt_key
CLIENT_URL=https://your-frontend.vercel.app

RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Storage (MinIO local or AWS S3 production)
MINIO_ENDPOINT=            # Leave blank for localhost MinIO in dev
MINIO_PORT=9000
MINIO_ACCESS_KEY=          # or MINIO_ROOT_USER
MINIO_SECRET_KEY=          # or MINIO_ROOT_PASSWORD
MINIO_BUCKET_NAME=         # or MINIO_DEFAULT_BUCKET
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_DEFAULT_BUCKET=anti-print

# Optional
GOOGLE_CLIENT_ID=          # For Google OAuth on backend verification
VITE_GOOGLE_CLIENT_ID=     # Fallback used by authController
AWS_REGION=us-east-1
S3_FORCE_PATH_STYLE=true   # true for MinIO, false for AWS
```

---

### Models (`backend/src/models/`)

#### `User.ts` - IUser
| Field | Type | Notes |
|-------|------|-------|
| name | String | Required |
| email | String | Required, unique |
| role | 'USER' / 'OWNER' / 'EMPLOYEE' | Default: 'USER' |
| googleId | String | Hidden by default (select: false) |
| password | String | Hidden by default (select: false) |
| associatedShop | ObjectId -> Shop | For EMPLOYEEs |
| createdAt / updatedAt | Date | Auto (timestamps) |

#### `Shop.ts` - IShop
| Field | Type | Notes |
|-------|------|-------|
| owner | ObjectId -> User | Required |
| name | String | Required |
| address | String | Required |
| location | {type: 'Point', coordinates: [lng, lat]} | GeoJSON |
| image | String | S3 key (NOT full URL). Sign before returning |
| status | 'OPEN' / 'CLOSED' / 'BUSY' | Default: 'OPEN' |
| pricing.bw | {single: 3, double: 2} | Default prices |
| pricing.color | {single: 10, double: 8} | Default prices |
| pricing.bulkDiscount | {enabled, threshold, bwPrice, colorPrice} | |
| pricing.otherSizes | {A3, A2, A1} each {bw, color} | |

IMPORTANT: shop.image stores the S3 key (e.g. MyShop_123/profile-abc.jpg), NOT a full URL. Always generate presigned URL before sending to frontend.

#### `Order.ts` - IOrder
| Field | Type | Notes |
|-------|------|-------|
| shop | ObjectId -> Shop | Required |
| user | ObjectId -> User | Required |
| items | IOrderItem[] | Array of files |
| totalAmount | Number | In INR |
| paymentStatus | 'PENDING' / 'PAID' / 'FAILED' / 'REFUNDED' | |
| paymentId | String | Razorpay payment ID |
| orderStatus | 'QUEUED' / 'PROCESSING' / 'PRINTING' / 'READY' / 'COMPLETED' / 'CANCELLED' | |
| pickupCode | String | 4-digit code |

IOrderItem fields:
- storageKey: S3 key for original file
- originalName: Original filename
- fileHash: SHA-256 for deduplication/batching
- fileType: 'pdf', 'docx', 'pptx', etc.
- pageCount: Total pages
- convertedKey: S3 key for converted PDF (set after conversion)
- config: {color, side, copies, paperType, pageRange, orientation, paperSize}
- calculatedCost: Cost for this file in INR

Order Status Flow:
```
QUEUED -> [payment] -> PROCESSING -> [conversion done] -> QUEUED -> PRINTING -> READY -> COMPLETED
                                                                                -> CANCELLED
```

---

### Auth (`backend/src/middlewares/authMiddleware.ts`)
- `protect` - Verifies JWT from `Authorization: Bearer <token>` header. Attaches `req.user` (full IUser without password)
- `authorize(...roles)` - Role-based access control middleware
- `AuthRequest` extends `Request` with optional `user?: IUser`

### Token (`backend/src/utils/generateToken.ts`)
- Signs JWT with `userId` payload, 30-day expiry
- Sets HttpOnly cookie AND returns token in JSON
- Token stored in `sessionStorage` on frontend (see AuthContext)

### Socket (`backend/src/utils/socket.ts`)
- Singleton pattern: `initSocket(io)` then `getIO()`
- Events emitted FROM server:
  - `new_order` to shop room (after conversion)
  - `order_status_updated` to shop room AND user room
  - `order_updated` to user room
  - `notification` to user room (for cancel/refund)

---

### Routes (`backend/src/routes/`)

#### `authRoutes.ts` -> `/api/auth`
| Method | Path | Controller | Auth |
|--------|------|------------|------|
| POST | /register-user | registerUser | Public |
| POST | /register-shop | registerShopOwner | Public |
| POST | /login | loginUser | Public |
| POST | /google | googleLogin | Public |

#### `shopRoutes.ts` -> `/api/shops`
| Method | Path | Controller | Auth |
|--------|------|------------|------|
| GET | / | getAllShops | Public |
| GET | /qr/:id | getShopById | Public |
| POST | / | createShop | OWNER |
| GET | /my-shop | getMyShop | OWNER, EMPLOYEE |
| PUT | /status | toggleShopStatus | OWNER, EMPLOYEE |
| POST | /employees | addEmployee | OWNER |
| PUT | /pricing | updatePricing | OWNER |
| PUT | /:id | updateShop | OWNER |

#### `uploadRoutes.ts` -> `/api/upload`
| Method | Path | Controller | Auth |
|--------|------|------------|------|
| POST | / | uploadFile | Any authenticated |
| POST | /preview-pdf | getPreviewPdf | OWNER, EMPLOYEE |

- Max file size: 50MB (multer memory storage)
- File lands in {shopId}/temp/{uuid}.{ext} in MinIO

#### `orderRoutes.ts` -> `/api/orders`
| Method | Path | Controller | Auth |
|--------|------|------------|------|
| POST | / | createOrder | Any authenticated |
| POST | /checkout | createPaymentOrder | Any authenticated |
| POST | /verify | verifyPayment | Any authenticated |
| GET | /shop | getShopOrders | OWNER, EMPLOYEE |
| GET | /history | getShopHistory | OWNER, EMPLOYEE |
| GET | /my | getMyOrders | Any authenticated |
| PUT | /:id/status | updateOrderStatus | OWNER, EMPLOYEE |
| PUT | /:id/cancel | cancelOrder | Any authenticated |

---

### Controllers (`backend/src/controllers/`)

#### `authController.ts`
- registerUser: Creates USER role. Validates email regex + min 6 char password.
- registerShopOwner: Creates OWNER role. If email exists but NO shop, deletes orphan user and re-registers.
- loginUser: Email+password, selects password explicitly (+password).
- googleLogin: Verifies Google JWT via google-auth-library. Auto-creates USER if new.

#### `orderController.ts`
- createOrder: Calculates cost per file using shop pricing (handles bulk, A3/A2/A1 sizes), moves files from {shopId}/temp/ to {ShopName_ShopID}/{UserName_OrderID}/ in MinIO.
- createPaymentOrder: Creates Razorpay order (amount in paise = totalAmount * 100).
- verifyPayment: HMAC-SHA256 signature verification. On success: sets PAID, triggers processOrderFiles() async, emits socket to user.
- getShopOrders: Returns all orders for shop, populated with user name/email.
- updateOrderStatus: Updates orderStatus, emits to both shop and user rooms.
- cancelOrder: Only cancellable if QUEUED. Initiates Razorpay refund if paid. Emits cancel/refund notification.
- getShopHistory: Filter by date range. In-memory search by user name or order ID.
- getMyOrders: Returns all orders for logged-in user.

#### `shopController.ts`
- createShop: Creates shop. Moves profile image from temp to {ShopName_ShopID}/profile-{filename}.
- getMyShop: Returns shop for OWNER (by owner field) or EMPLOYEE (by associatedShop).
- getAllShops: Filters out CLOSED shops. Sorts by Euclidean distance if lat/lng provided. Generates presigned URLs for images. Limit 30.
- getShopById: Public. Generates presigned URL for image.
- toggleShopStatus: Flips OPEN<->CLOSED.
- updatePricing: Updates pricing.bw, pricing.color, pricing.bulkDiscount via $set.
- addEmployee: Creates new User with EMPLOYEE role, associatedShop set to owner's shop.

#### `uploadController.ts`
- uploadFile: Hashes file (SHA-256), calls Python analyze.py for page count & type, uploads to MinIO, returns {storageKey, fileHash, pageCount, fileType}.
- getPreviewPdf: Downloads from S3, converts non-PDF via convert.py, returns PDF/image buffer.

---

### Services (`backend/src/services/`)

#### `conversionService.ts` - processOrderFiles(orderId)
- Called async after payment verification (fire & forget)
- Downloads non-PDF files from S3, runs convert.py on them
- Uploads converted PDF to {ShopFolder}/{OrderFolder}/converted/{name}.pdf
- Sets item.convertedKey on the order
- Updates order status to QUEUED (ready for shop)
- Emits new_order to shop, order_status_updated + order_updated to user

---

### Python Scripts (`backend/src/scripts/`)

#### `analyze.py`
- Args: <filePath>
- Output: JSON {pageCount: number, type: string} to stdout
- Handles: PDF (via PyPDF2), DOCX (python-docx), PPTX (python-pptx)
- Fallback: {pageCount: 1, type: 'unknown'}

#### `convert.py`
- Args: <inputPath> <outputPath>
- Converts DOCX/PPTX to PDF using LibreOffice or python libraries
- Used in both uploadController.getPreviewPdf and conversionService.processOrderFiles

#### `resetDb.ts` - Dev utility to wipe/reset the database
#### `triggerCleanup.ts` - Dev utility to manually trigger the cron cleanup
#### `debugData.ts` - Dev utility for debugging

---

### Cron (`backend/src/cron.ts`)
- Runs every hour (0 * * * *)
- Lists all MinIO objects, deletes files older than 24 hours
- Keeps: Profile images (profile-* at depth 2)
- Deletes: All temp files + order files older than 24h

---

### Config (`backend/src/config/`)

#### `db.ts`
- Connects to MongoDB via MONGO_URI
- Retry logic: 5 attempts, 5s delay between each
- Crashes app (process.exit(1)) if all retries fail

#### `s3.ts`
- AWS SDK v2 (aws-sdk)
- Auto-detects MinIO vs AWS S3 based on NODE_ENV and MINIO_ENDPOINT
- BUCKET_NAME exported: MINIO_BUCKET_NAME || MINIO_DEFAULT_BUCKET || 'anti-print'
- Auto-creates bucket if not found
- s3ForcePathStyle: true for MinIO, false for AWS

---

## FRONTEND

### Tech Stack
- React 19 + TypeScript
- Vite 7 (build tool)
- TailwindCSS 3.4 (styling)
- React Router v7
- Axios (API calls)
- Socket.io-client
- react-hot-toast (notifications)
- react-leaflet + leaflet (map)
- html5-qrcode (QR scanning)
- react-qr-code (QR display)
- @react-oauth/google (Google login)
- print-js (browser printing)
- lucide-react (icons)
- mammoth (DOCX preview in browser)

### Entry Point - `frontend/src/main.tsx`
- Provider order (outside-in): GoogleOAuthProvider -> ThemeProvider -> BrowserRouter -> AuthProvider -> App
- Toaster from react-hot-toast (bottom-right, dark style)
- Google Client ID: VITE_GOOGLE_CLIENT_ID env var

### Environment Variables (frontend/.env.example)
```
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=   # Google OAuth Client ID
```

---

### Context (`frontend/src/context/`)

#### `AuthContext.tsx`
- State: user: {_id, name, email, role}, isLoading
- Storage: sessionStorage (NOT localStorage) - clears on tab close
- login(userData, token): saves user + token to sessionStorage
- logout(): clears sessionStorage
- Token auto-attached to API requests via axios interceptor in api.ts

#### `ThemeContext.tsx`
- Dark mode is DISABLED (hardcoded to 'light')
- Removes any lingering dark classes on mount
- toggleTheme() does nothing

---

### Styling (`frontend/src/`)

#### `tailwind.config.js`
- Colors:
  - primary: #EAFF00 (Neon Yellow)
  - primary-hover: #D4E600
  - secondary: #0F172A (Slate 900)
  - bg.body, bg.card, bg.input
- Font: Outfit (from Google Fonts)
- Dark mode: disabled in ThemeContext

#### `index.css`
- Custom component classes:
  - .btn - base button styles
  - .btn-primary - neon yellow with glow shadow
  - .btn-secondary - white/bordered
  - .btn-outline - transparent/bordered
  - .input-field - standard input styling
- Font: Outfit via Google Fonts import

---

### API Service (`frontend/src/services/api.ts`)
- Axios instance, baseURL = VITE_API_URL + '/api'
- Request interceptor: auto-attaches Authorization: Bearer <token> from sessionStorage

---

### Pages (`frontend/src/pages/`)

#### `Landing.tsx` (Route: /)
- Public landing page
- Responsive navbar with mobile hamburger menu
- Hero section, feature cards
- Links to /login and /register-shop

#### `Login.tsx` (Route: /login)
- Two tabs: User (Google OAuth) and Shop (email/password)
- User tab: GoogleLogin component -> POST /api/auth/google
- Shop tab: email/password form -> POST /api/auth/login
- After login: USER -> /user/dashboard, OWNER/EMPLOYEE -> /shop/dashboard
- Handles ?shopId= query param (from QR scan deep link)

#### `RegisterShop.tsx` (Route: /register-shop)
- OWNER registration form
- POST /api/auth/register-shop
- On success -> redirects to /shop/setup

#### `RegisterUser.tsx` (Route: /register-user)
- USER registration form
- POST /api/auth/register-user

#### `ShopSetup.tsx` (Route: /shop/setup, OWNER only)
- One-time shop setup after OWNER registration
- Map-based location picker (Leaflet)
- Profile image upload
- POST /api/shops

#### `ShopDashboard.tsx` (Route: /shop/dashboard, OWNER + EMPLOYEE) [579 lines]
- Desktop-only (mobile restriction shown if window.innerWidth < 768)
- Socket.io: joins shop room, listens for new_order, order_status_updated
- Real-time order list with status badges
- PDF/document preview via POST /api/upload/preview-pdf -> opens in iframe
- Print orders via print-js
- Toggle shop OPEN/CLOSED
- QR code display + download
- Add employee modal (OWNER only)
- Stats: pending orders, printed today, revenue
- Links to /shop/settings, /shop/history

#### `ShopHistory.tsx` (Route: /shop/history, OWNER + EMPLOYEE)
- Completed/cancelled order history
- Date range filter + search by user name or order ID
- GET /api/orders/history?startDate=&endDate=&search=

#### `ShopSettings.tsx` (Route: /shop/settings, OWNER only) [312 lines]
- Pricing management: B&W (single/double), Color (single/double)
- Bulk discount settings
- Other paper sizes (A3, A2, A1) pricing
- PUT /api/shops/pricing

#### `UserDashboard.tsx` (Route: /user/dashboard, All roles) [931 lines - MOST COMPLEX PAGE]
- Socket.io: joins user room, listens for order updates
- Shop list with map toggle (Leaflet) + distance sorting
- QR scanner to select shop directly
- File upload via FileUpload component
- Cart management with print config per file
- Razorpay payment integration (loads checkout.js dynamically)
- Order history modal
- Pickup notification modal when order is READY/COMPLETED
- POST /api/orders -> POST /api/orders/checkout -> POST /api/orders/verify

#### `Support.tsx` (Route: /support)
- Static support/FAQ page

---

### Components (`frontend/src/components/`)

#### `FileUpload.tsx` [169 lines]
- Drag & drop + click-to-upload
- Allowed types: PDF, DOCX, DOC, PPTX, PPT, PNG, JPG, JPEG (filtered client-side)
- Max size: 50MB (enforced client-side too)
- Uploads each file sequentially to POST /api/upload with shopId in FormData
- Returns {storageKey, originalName, fileHash, pageCount, fileType, previewUrl?} via onUploadComplete callback

#### `QRScanner.tsx` [~200 lines]
- Wraps html5-qrcode library
- Scans QR code -> extracts shopId from URL
- Used in UserDashboard to jump directly to a shop

#### `ErrorBoundary.tsx`
- React class component error boundary
- Catches render errors, shows fallback UI

---

### Routing (`frontend/src/App.tsx`)
```
/ -> Landing (public)
/login -> Login (public)
/register-shop -> RegisterShop (public)
/register-user -> RegisterUser (public)
/support -> Support (public)
/shop/setup -> ShopSetup (OWNER only)
/shop/dashboard -> ShopDashboard (OWNER + EMPLOYEE)
/shop/history -> ShopHistory (OWNER + EMPLOYEE)
/shop/settings -> ShopSettings (OWNER only)
/user/dashboard -> UserDashboard (all roles)
```
- ProtectedRoute component checks AuthContext.user + user.role
- Unauthenticated -> redirect to /login
- Wrong role -> redirect to /

---

## Infrastructure (`docker-compose.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| mongo | mongo:6.0 | configurable | Primary database |
| redis | redis:alpine | configurable | Configured but NOT USED in app code |
| minio | minio/minio | 9000 (API), 9001 (Console) | File storage |
| createbuckets | minio/mc | - | Auto-creates default bucket on startup |

---

## Key Design Patterns & Gotchas

### File Storage Key Pattern
```
MinIO Key Structure:
temp/                          <- Root temp (fallback)
{shopId}/temp/{uuid}.{ext}     <- Upload stage
{ShopName_ShopId}/
  profile-{uuid}.{ext}         <- Shop profile image (NEVER deleted by cron)
  {UserName_OrderId}/
    {OriginalFile}.{ext}        <- Order file
    converted/
      {name}.pdf               <- Converted PDF
```
- Always call s3.getSignedUrlPromise() before returning image URLs to frontend
- Profile images are KEPT by cron (not deleted after 24h)
- Order files are deleted after 24h

### Payment Flow
```
1. User submits cart -> POST /api/orders -> {orderId, totalAmount}
2. POST /api/orders/checkout -> {razorpayOrderId, amount, keyId}
3. Open Razorpay checkout modal
4. On success -> POST /api/orders/verify (with razorpay_signature)
5. Backend verifies signature, marks PAID, triggers async conversion
6. Conversion completes -> status back to QUEUED, emits new_order to shop
```

### Pricing Calculation (MUST match in frontend and backend)
```
For A3/A2/A1 (large format):
  rate = isColor ? shop.pricing.otherSizes[size].color : shop.pricing.otherSizes[size].bw
  if (isDouble) rate *= 2

For A4:
  if (bulkDiscount.enabled AND totalSheets >= threshold):
    rate = bulk.bwPrice or bulk.colorPrice
  else:
    rate = pricing.bw/color.single or .double

totalSheets = pageCount * copies
fileCost = rate * totalSheets
```

### Socket.io Room Strategy
- Shops join room with their shop _id as room name
- Users join room with their user _id as room name
- Server emits to rooms (not individual socket IDs)

### Auth Strategy
- JWT stored in both HttpOnly cookie AND returned in JSON body
- Frontend uses token from sessionStorage (via axios interceptor)
- Backend protect middleware reads from Authorization: Bearer header
- Session ends when browser tab closes (sessionStorage)

### Python Dependencies (backend)
- python3 must be in PATH on the server
- Scripts: analyze.py uses PyPDF2, python-docx, python-pptx
- Scripts: convert.py uses LibreOffice/unoconv for conversion
- requirements.txt exists at backend/requirements.txt

---

## Known Issues / Technical Debt

1. Redis is configured in docker-compose but NOT used in the actual application code
2. Dark mode code exists (ThemeContext, CSS classes) but is permanently disabled in ThemeContext
3. Shop location coordinates stored as [lng, lat] (GeoJSON) but frontend Haversine uses [lat, lng] - potential coord flip issue
4. getAllShops uses simplified Euclidean distance not proper Haversine - approximation only
5. No 2dsphere index set on Shop.location in MongoDB - required for geo queries to perform well
6. Order search in getShopHistory fetches ALL orders then filters in memory - not scalable
7. index.html title is still "frontend" - should be changed to app name
8. No rate limiting on auth routes - potential for brute force
9. cancelOrder only allows cancellation if status is QUEUED but payment sets it to PROCESSING - user may be unable to cancel
10. Multer stores files in memory (multer.memoryStorage()) - large files could exhaust memory

---

## Quick Reference: Which File to Edit

| Task | File(s) |
|------|---------|
| Add new API route | backend/src/routes/*.ts + new controller fn |
| Change pricing logic | backend/src/controllers/orderController.ts (createOrder) + frontend/src/pages/UserDashboard.tsx (price preview) |
| Modify user/shop/order schema | backend/src/models/*.ts |
| Change auth behavior | backend/src/controllers/authController.ts + frontend/src/context/AuthContext.tsx |
| Shop dashboard UI | frontend/src/pages/ShopDashboard.tsx (579 lines) |
| User upload/order flow | frontend/src/pages/UserDashboard.tsx (931 lines) |
| Pricing settings UI | frontend/src/pages/ShopSettings.tsx |
| File upload component | frontend/src/components/FileUpload.tsx |
| Socket events | backend/src/utils/socket.ts + orderController.ts + conversionService.ts |
| File conversion pipeline | backend/src/services/conversionService.ts + backend/src/scripts/convert.py |
| Page count analysis | backend/src/scripts/analyze.py |
| Storage/S3 config | backend/src/config/s3.ts |
| Cron cleanup logic | backend/src/cron.ts |
| Global CSS/styles | frontend/src/index.css + frontend/tailwind.config.js |
| App routing | frontend/src/App.tsx |
| API base URL | frontend/src/services/api.ts |

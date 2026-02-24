# Free Deployment Guide for XeroxSaaS

This guide outlines how to deploy your XeroxSaaS application for **free** using standard industry providers.

## Architecture
- **Frontend:** Vercel (Free Tier)
- **Backend:** Render (Free Web Service)
- **Database:** MongoDB Atlas (Free M0 Cluster)
- **Storage:** AWS S3 (Free Tier - 5GB/12months) or Backblaze B2 (10GB Free)

---

## Step 1: Database (MongoDB Atlas)

1.  Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2.  Create a free account.
3.  Build a **Database**. Select **M0 (Free)** tier.
4.  **Network Access:** Allow access from anywhere (`0.0.0.0/0`) since Render's IP changes.
5.  **Database Access:** Create a database user (username/password).
6.  **Connect:** Choose "Connect your application" -> Drivers -> Node.js.
7.  Copy the connection string. It looks like:
    `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
    *Replace `<password>` with your actual password.*

---

## Step 2: Storage (AWS S3 or Compatible)

You need a place to store uploaded files. The app is configured for AWS S3 or MinIO.

**Option A: AWS S3 (Recommended for Free Tier)**
1.  Sign up for AWS Free Tier.
2.  Go to **S3** and create a **Bucket** (e.g., `xerox-saas-files`).
    - Uncheck "Block all public access" if you want files to be public (or configure policies later).
    - **Region:** Note the region (e.g., `us-east-1`).
3.  Go to **IAM** (Identity and Access Management).
4.  Create a **User** -> Attach existing policies directly -> **AmazonS3FullAccess**.
5.  Create **Access Keys** for this user. Save the `Access Key ID` and `Secret Access Key`.

---

## Step 3: Backend Deployment (Render)

1.  Push your code to **GitHub**.
2.  Go to [Render](https://render.com/).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Root Directory:** `backend` (Important! Your backend is in a subfolder).
6.  **Settings:**
    - **Name:** `xerox-backend`
    - **Environment:** `Node`
    - **Build Command:** `npm install && npm run build`
    - **Start Command:** `npm start`
7.  **Environment Variables:** Add the following:
    - `NODE_ENV`: `production`
    - `PORT`: `5000`
    - `MONGO_URI`: *(Paste string from Step 1)*
    - `JWT_SECRET`: *(Generate a long random string)*
    - `CLIENT_URL`: *(Leave empty for now, update after deploying Frontend)*
    - `MINIO_ACCESS_KEY`: *(Your AWS Access Key ID)*
    - `MINIO_SECRET_KEY`: *(Your AWS Secret Access Key)*
    - `MINIO_BUCKET_NAME`: *(Your Bucket Name)*
    - `AWS_REGION`: `us-east-1` (Or your region)
    - `S3_FORCE_PATH_STYLE`: `false` (For AWS. If using MinIO/Backblaze, set to `true`)
8.  Click **Deploy Web Service**.
9.  Wait for deployment. Copy the **Service URL** (e.g., `https://xerox-backend.onrender.com`).

---

## Step 4: Frontend Deployment (Vercel)

1.  Go to [Vercel](https://vercel.com/).
2.  Click **Add New...** -> **Project**.
3.  Import your GitHub repository.
4.  **Framework Preset:** Vite (Should detect automatically).
5.  **Root Directory:** Click "Edit" and select `frontend`.
6.  **Environment Variables:**
    - `VITE_API_URL`: *(Paste your Render Backend URL, e.g., https://xerox-backend.onrender.com)*
      *Note: Do NOT add a trailing slash `/`.*
7.  Click **Deploy**.

---

## Step 5: Final Configuration

1.  Once Frontend is deployed, copy its URL (e.g., `https://xerox-saas.vercel.app`).
2.  Go back to **Render** -> Dashboard -> Select Backend -> **Environment**.
3.  Add/Update `CLIENT_URL` with the Frontend URL. This fixes CORS issues.
4.  **Redeploy** the backend (Manual Deploy -> Deploy latest commit) to apply the new env var.

## Troubleshooting
- **CORS Error?** Check `CLIENT_URL` in Backend and ensure it matches the Frontend URL exactly (no trailing slash usually).
- **Database Error?** Check IP Whitelist in MongoDB Atlas (`0.0.0.0/0`).
- **Upload Error?** Check AWS Keys and Bucket permissions.

You are now live! 🚀

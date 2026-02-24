# 🚀 Free Tier Deployment Guide for XeroxSaaS

This guide will walk you through deploying the **XeroxSaaS** application (MERN Stack) completely for **FREE** using the following services:

1.  **Database:** MongoDB Atlas (Free Shared Cluster)
2.  **Backend:** Render (Free Web Service)
3.  **Frontend:** Vercel (Free Static Hosting)
4.  **Storage:** Cloudflare R2 (Free Tier) or AWS S3 (Free Tier 12mo)
5.  **Maps:** OpenStreetMap (Free)

---

## 🛠️ Phase 1: Database Setup (MongoDB Atlas)

1.  Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up/login.
2.  Create a new **Project**.
3.  Click **Create a Deployment**.
4.  Select **M0 Sandbox (Free)**.
5.  Choose a provider (AWS) and region closest to you. Click **Create**.
6.  **Security Quickstart:**
    *   **Username/Password:** Create a database user (e.g., `xerox_admin`). **Save this password!**
    *   **IP Access List:** Select "Allow Access from Anywhere" (`0.0.0.0/0`) since Render's IP changes.
7.  Go to **Database** -> **Connect** -> **Drivers**.
8.  Copy the connection string. It looks like:
    `mongodb+srv://xerox_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
9.  Replace `<password>` with your actual password. **Keep this string safe.**

---

## ☁️ Phase 2: Cloud Storage Setup (AWS S3)

*Since the backend on Render "spins down" and wipes local files, you MUST use cloud storage for file uploads.*

**Option A: AWS S3 (Free Tier for 12 Months)**
1.  Sign up for [AWS Console](https://aws.amazon.com/).
2.  Search for **S3** and create a **Bucket** (e.g., `xerox-files-storage`).
    *   Uncheck "Block all public access" (if you want public links) OR keep it private and use signed URLs (safer).
    *   **Region:** Note the region (e.g., `us-east-1`).
3.  Search for **IAM** -> **Users** -> **Create User**.
    *   Name: `xerox-s3-user`.
    *   Attach policies directly -> Search `AmazonS3FullAccess` (easiest) or create a specific policy for just one bucket (safer).
4.  Click the user -> **Security Credentials** -> **Create Access Key**.
5.  **Save the Access Key ID and Secret Access Key.**

---

## 🔙 Phase 3: Backend Deployment (Render)

1.  Push your code to **GitHub**.
2.  Go to [Render Dashboard](https://dashboard.render.com/).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Settings:**
    *   **Name:** `xerox-backend`
    *   **Region:** Same as your DB/S3 if possible.
    *   **Branch:** `main`
    *   **Root Directory:** `backend` (Important!)
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install && npm run build`
    *   **Start Command:** `npm start`
    *   **Plan:** Free

6.  **Environment Variables (Advanced):**
    Add the following keys:

    | Key | Value |
    | :--- | :--- |
    | `NODE_ENV` | `production` |
    | `PORT` | `5000` |
    | `MONGO_URI` | *(Paste your MongoDB Connection String from Phase 1)* |
    | `JWT_SECRET` | *(Generate a random long string)* |
    | `CLIENT_URL` | `https://your-frontend-project.vercel.app` (You will update this later) |
    | `MINIO_ENDPOINT` | `s3.amazonaws.com` (for AWS) |
    | `MINIO_ACCESS_KEY` | *(Your AWS Access Key ID)* |
    | `MINIO_SECRET_KEY` | *(Your AWS Secret Access Key)* |
    | `MINIO_BUCKET_NAME` | *(Your Bucket Name)* |
    | `AWS_REGION` | `us-east-1` (Your bucket region) |

7.  Click **Create Web Service**.
8.  **Wait for deployment.** It might take a few minutes.
9.  **Copy your Backend URL.** It will look like: `https://xerox-backend.onrender.com`.

---

## 🎨 Phase 4: Frontend Deployment (Vercel)

1.  Go to [Vercel](https://vercel.com/) and login with GitHub.
2.  Click **Add New...** -> **Project**.
3.  Import the same GitHub repository.
4.  **Configure Project:**
    *   **Framework Preset:** Vite
    *   **Root Directory:** Click `Edit` and select `frontend`.
5.  **Environment Variables:**
    *   Key: `VITE_API_URL`
    *   Value: *(Paste your Render Backend URL, e.g., `https://xerox-backend.onrender.com`)* **(No trailing slash!)**
6.  Click **Deploy**.
7.  Wait for the confetti! 🎉
8.  **Copy your Frontend Domain.** (e.g., `https://xerox-saas.vercel.app`)

---

## 🔗 Phase 5: Final Wiring

1.  Go back to **Render Dashboard** -> `xerox-backend` -> **Environment**.
2.  Edit `CLIENT_URL` and paste your **Vercel Frontend URL** (e.g., `https://xerox-saas.vercel.app`).
3.  **Save Changes.** Render will automatically restart the server.

---

## ✅ Verification

1.  Open your Vercel URL.
2.  Try to **Register** a new user.
3.  Login.
4.  Upload a file. (If S3 is configured correctly, it won't crash).
5.  Check if the "Socket Connected" logs appear in the browser console.

**Enjoy your free SaaS deployment!** 🚀

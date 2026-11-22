# Atrium — AI Room & Object Visualizer

A full-stack AI staging studio that previews any object inside an uploaded room photograph with realistic scale, perspective, ambient lighting, and grounded contact shadows.

Powered by direct multi-image editing with **Cloudflare Workers AI** (`@cf/black-forest-labs/flux-2-klein-4b`).

---

## Features

- **Direct Multi-Image In-Place Editing:** Feeds both the authentic room photo (`image 0`) and reference object (`image 1`) directly into FLUX.2 [klein] 4B. Preserves the exact room architecture, lighting, and existing furniture while realistically inserting the object.
- **Aspect Ratio Preservation:** Computes optimal target dimensions to maintain the original room's exact aspect ratio without cropping or distortion.
- **Multi-Variation Generation:** Generates 1–3 parallel variations with distinct random seeds and natural focal angles.
- **Sample Catalog & Custom Uploads:** Test immediately with pre-configured sample rooms and designer catalog objects, or upload your own room and object images.
- **Full-Stack Architecture:** Built with React 19, Vite, Tailwind CSS, and an Express API ready for both standalone Node.js and Vercel Serverless deployments.

---

## Getting Started Locally

### Prerequisites
- Node.js 18+ installed

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MR-MK47/atrium-ai-room-object-visualizer.git
   cd atrium-ai-room-object-visualizer
   ```

2. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Cloudflare Workers AI credentials:
   ```env
   AI_PROVIDER="cloudflare"
   CF_IMAGE_MODEL="@cf/black-forest-labs/flux-2-klein-4b"
   CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"
   CLOUDFLARE_API_TOKEN="your_cloudflare_api_token"
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying to Vercel

### Step 1: Push to GitHub
Ensure your repository is pushed to GitHub (already prepared via `main` branch).

### Step 2: Import into Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Select **Import** next to your GitHub repository `atrium-ai-room-object-visualizer`.
4. Framework Preset: **Vite** (detected automatically).
5. Build & Output Settings (default):
   - **Build Command:** `vite build`
   - **Output Directory:** `dist`

### Step 3: Configure Environment Variables in Vercel
In the **Environment Variables** section of the Vercel deployment wizard, add:

| Name | Recommended Value | Description |
|---|---|---|
| `AI_PROVIDER` | `cloudflare` | Sets active provider to Cloudflare Workers AI |
| `CF_IMAGE_MODEL` | `@cf/black-forest-labs/flux-2-klein-4b` | Default direct multi-image edit model |
| `CLOUDFLARE_ACCOUNT_ID` | *your_account_id* | Cloudflare dashboard account ID |
| `CLOUDFLARE_API_TOKEN` | *your_api_token* | API Token with Workers AI "Run" permissions |

*(Optional)* If you also wish to use Google Gemini:
- `GEMINI_API_KEY`: Your Gemini API key

### Step 4: Deploy
Click **Deploy**. Vercel will build the frontend into `dist/` and configure the `/api` routes via `api/index.ts` automatically!

# Toest-to-Bsky

**Toest-to-Bsky** is a small Node.js utility that checks [the Toest YouTube channel](https://www.youtube.com/channel/UCVm2b2ixDSfQ2WPLZX3bX2Q) once a week and automatically posts any newly published videos to a Bluesky profile.

---

## 🚀 Features

- Fetches the latest video from a specified YouTube channel via the YouTube Data API v3  
- Publishes a Bluesky post with an embedded video preview  
- Runs automatically every Friday at 18:00 Sofia time (UTC+3) via GitHub Actions  
- Configurable entirely through environment variables and GitHub Secrets  

---

## ⚙️ Prerequisites

- **Node.js** v18 or later  
- A **GitHub** repository (Free plan is sufficient) with Actions enabled  
- A **YouTube Data API v3** key  
- A **Bluesky** account and an App Password  

---

## 🔧 Installation

```bash
git clone https://github.com/yourusername/yourrepo.git
cd yourrepo
npm install
```

---

## 🔑 Configuration

### 1. Environment Variables

Create a `.env` file in the project root (this file is ignored by Git):

```env
YOUTUBE_API_KEY=your_youtube_api_key
BSKY_USERNAME=your_handle.bsky.social
BSKY_APP_PASSWORD=your_app_password
CHANNEL_ID=channel_id
```

- `YOUTUBE_API_KEY` — your YouTube Data API v3 key  
- `BSKY_USERNAME` — your Bluesky handle (without the leading `@`), e.g. `teodossi.bsky.social`  
- `BSKY_APP_PASSWORD` — the App Password you generated in Bluesky Settings → Security & privacy → App passwords  
- `CHANNEL_ID` — the ID of the YouTube channel to monitor  

### 2. GitHub Secrets

In your GitHub repository go to **Settings → Secrets and variables → Actions** and add:

- `YOUTUBE_API_KEY`  
- `BSKY_USERNAME`  
- `BSKY_APP_PASSWORD`  

---

## 📦 Usage

### Local

You can test the script locally by running:

```bash
npm run checkAndPost
```

This uses `env-cmd` to load your `.env` before executing the script.

### GitHub Actions

The workflow file is located at `.github/workflows/youtube-to-bsky.yml`. It runs:

- **Schedule**: `cron: '0 15 * * FRI'`  
  - Every Friday at 15:00 UTC (18:00 UTC+3)  
- **Steps**:  
  1. Checkout your repository  
  2. Setup Node.js v18  
  3. Install dependencies  
  4. Run `node src/checkAndPost.js` with the required secrets injected  

You can also manually trigger it via the **Actions** tab.

---

## 📄 License

This project is licensed under the **MIT** License.

# Clipme

A beautiful desktop app to clip and download videos from YouTube, TikTok, Instagram, and more.

## Features

- 🎬 Download and clip videos from various platforms
- ✂️ Cut specific sections with precise start/end times
- 📊 Multiple quality options (from 480p to 8K)
- 🔄 Format conversion (MP4, WebM, MKV, etc.)
- 🎵 Audio-only extraction

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version)
- [Rust](https://rustup.rs/)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Install dependencies

```bash
npm install
```

### Download sidecar binaries

The app bundles `yt-dlp`, `ffmpeg`, and `ffprobe` as sidecar binaries. Before building, download them:

```bash
chmod +x scripts/download-binaries.sh
./scripts/download-binaries.sh
```

### Run in development mode

```bash
npm run tauri dev
```

### Build for production

```bash
npm run tauri build
```

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **Video Processing**: yt-dlp + FFmpeg (bundled as sidecars)

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

#!/bin/bash
# Script to download sidecar binaries for local development
# Run this script before building the app locally

set -e

BINARIES_DIR="src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    ARCH=$(uname -m)
    if [[ "$ARCH" == "arm64" ]]; then
        TARGET="aarch64-apple-darwin"
    else
        TARGET="x86_64-apple-darwin"
    fi
    YTDLP_ASSET="yt-dlp_macos"
    
    echo "📦 Platform: macOS ($ARCH)"
    echo "🎯 Target: $TARGET"
    
    # Download yt-dlp
    echo ""
    echo "📥 Downloading yt-dlp..."
    curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$YTDLP_ASSET" \
        -o "$BINARIES_DIR/yt-dlp-$TARGET"
    chmod +x "$BINARIES_DIR/yt-dlp-$TARGET"
    
    # Download ffmpeg from evermeet.cx (macOS static builds)
    echo ""
    echo "📥 Downloading ffmpeg..."
    curl -L "https://evermeet.cx/ffmpeg/getrelease/zip" -o /tmp/ffmpeg.zip
    unzip -o /tmp/ffmpeg.zip -d /tmp
    mv /tmp/ffmpeg "$BINARIES_DIR/ffmpeg-$TARGET"
    chmod +x "$BINARIES_DIR/ffmpeg-$TARGET"
    rm /tmp/ffmpeg.zip
    
    # Download ffprobe
    echo ""
    echo "📥 Downloading ffprobe..."
    curl -L "https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip" -o /tmp/ffprobe.zip
    unzip -o /tmp/ffprobe.zip -d /tmp
    mv /tmp/ffprobe "$BINARIES_DIR/ffprobe-$TARGET"
    chmod +x "$BINARIES_DIR/ffprobe-$TARGET"
    rm /tmp/ffprobe.zip
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    TARGET="x86_64-pc-windows-msvc"
    
    echo "📦 Platform: Windows"
    echo "🎯 Target: $TARGET"
    
    # Download yt-dlp
    echo ""
    echo "📥 Downloading yt-dlp..."
    curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" \
        -o "$BINARIES_DIR/yt-dlp-$TARGET.exe"
    
    # Download ffmpeg
    echo ""
    echo "📥 Downloading ffmpeg (this may take a while)..."
    curl -L "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -o /tmp/ffmpeg.zip
    unzip -o /tmp/ffmpeg.zip -d /tmp
    FFMPEG_DIR=$(find /tmp -maxdepth 1 -type d -name "ffmpeg-*" | head -1)
    cp "$FFMPEG_DIR/bin/ffmpeg.exe" "$BINARIES_DIR/ffmpeg-$TARGET.exe"
    cp "$FFMPEG_DIR/bin/ffprobe.exe" "$BINARIES_DIR/ffprobe-$TARGET.exe"
    rm -rf "$FFMPEG_DIR" /tmp/ffmpeg.zip
    
else
    echo "❌ Unsupported platform: $OSTYPE"
    exit 1
fi

echo ""
echo "✅ Done! Binaries downloaded to $BINARIES_DIR:"
ls -la "$BINARIES_DIR"
echo ""
echo "🚀 You can now build the app with: npm run tauri build"

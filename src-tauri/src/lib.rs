use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;

struct AppState {
    download_pid: Mutex<Option<u32>>,
    download_path: Mutex<Option<PathBuf>>,
    current_file_path: Mutex<Option<PathBuf>>,
}

/// Get the target triple for the current platform
fn get_target_triple() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    { "aarch64-apple-darwin" }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    { "x86_64-apple-darwin" }
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    { "x86_64-pc-windows-msvc" }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    { "x86_64-unknown-linux-gnu" }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    { "aarch64-unknown-linux-gnu" }
}

/// Get the file extension for executables on the current platform
fn get_exe_extension() -> &'static str {
    #[cfg(target_os = "windows")]
    { ".exe" }
    #[cfg(not(target_os = "windows"))]
    { "" }
}

/// Get the path to a bundled sidecar binary.
/// Tauri requires binaries to be named with -$TARGET_TRIPLE suffix.
fn get_sidecar_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let target_triple = get_target_triple();
    let exe_ext = get_exe_extension();
    let binary_name = format!("{}-{}{}", name, target_triple, exe_ext);
    
    app.path()
        .resolve(format!("binaries/{}", binary_name), tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve {} path: {}", name, e))
}

/// Get the yt-dlp binary path
fn get_ytdlp_path(app: &AppHandle) -> Result<PathBuf, String> {
    get_sidecar_path(app, "yt-dlp")
}

/// Get the ffmpeg binary path  
fn get_ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    get_sidecar_path(app, "ffmpeg")
}

/// Get the ffprobe binary path (bundled alongside ffmpeg)
fn get_ffprobe_path(app: &AppHandle) -> Result<PathBuf, String> {
    get_sidecar_path(app, "ffprobe")
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VideoMetadata {
    title: String,
    duration: f64,
    formats: Vec<String>,
    preview_url: Option<String>,
}

#[derive(Clone, Serialize, Debug)]
pub struct DownloadProgress {
    percent: f64,
    speed: String,
    eta: String,
    downloaded: String,
    total: String,
    id: u64,
}

#[tauri::command]
async fn get_video_metadata(app: AppHandle, url: String) -> Result<VideoMetadata, String> {
    println!("Fetching metadata for: {}", url);

    // Get sidecar paths
    let ffprobe_path = get_ffprobe_path(&app)?;
    let ytdlp_path = get_ytdlp_path(&app)?;

    // Check if input is a local file
    let path = std::path::Path::new(&url);
    if path.exists() && path.is_file() {
        println!("Detected local file: {:?}", path);

        // Use ffprobe to get metadata
        let output = Command::new(&ffprobe_path)
            .args(&[
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                "-select_streams",
                "v:0",
                &url,
            ])
            .output()
            .map_err(|e| {
                format!(
                    "Failed to execute ffprobe: {}",
                    e
                )
            })?;

        if !output.status.success() {
            return Err("Failed to read video file metadata".to_string());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let json_val: serde_json::Value = serde_json::from_str(&stdout)
            .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

        let format = &json_val["format"];
        let streams = json_val["streams"].as_array();
        let stream = streams.and_then(|s| s.first());

        let title = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let duration = format["duration"]
            .as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);

        // Helper to get dim
        let get_dim = |key: &str| -> Option<u64> { stream.and_then(|s| s[key].as_u64()) };

        let width = get_dim("width").unwrap_or(1920);
        let height = get_dim("height").unwrap_or(1080);

        println!("Local video dimensions: {}x{}", width, height);

        let max_height = height;
        let mut formats: Vec<String> = vec!["Best".to_string()];
        if max_height >= 4320 {
            formats.push("8K".to_string());
        }
        if max_height >= 2160 {
            formats.push("4K".to_string());
        }
        if max_height >= 1440 {
            formats.push("1440p".to_string());
        }
        if max_height >= 1080 {
            formats.push("1080p".to_string());
        }
        if max_height >= 720 {
            formats.push("720p".to_string());
        }
        if max_height >= 480 {
            formats.push("480p".to_string());
        }
        formats.push("Audio Only".to_string());

        return Ok(VideoMetadata {
            title,
            duration,
            formats,
            preview_url: Some(url), // Local path is the preview URL
        });
    }

    let is_youtube = url.contains("youtube.com") || url.contains("youtu.be");

    let output = if is_youtube {
        Command::new(&ytdlp_path)
            .args(&["--dump-json", "--flat-playlist", "--no-warnings", &url])
            .output()
            .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?
    } else {
        // For non-YouTube (TikTok, Insta), we download the video to temp to ensure playback
        let temp_dir = std::env::temp_dir();
        // Use a consistent name pattern but include ID to avoid collision if needed
        let output_template = temp_dir.join("clipme_preview_%(id)s.%(ext)s");
        let template_str = output_template.to_string_lossy().to_string();

        println!("Downloading preview to: {}", template_str);

        Command::new(&ytdlp_path)
            .args(&[
                "--print-json",
                "--no-warnings",
                "-o",
                &template_str,
                "--force-overwrites",
                &url,
            ])
            .output()
            .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json_val: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let title = json_val["title"]
        .as_str()
        .unwrap_or("Unknown Title")
        .to_string();
    let duration = json_val["duration"].as_f64().unwrap_or(0.0);

    // Parse max height from available formats
    let mut max_height: u64 = 0;
    if let Some(formats_arr) = json_val["formats"].as_array() {
        for fmt in formats_arr {
            if let Some(h) = fmt["height"].as_u64() {
                if h > max_height {
                    max_height = h;
                }
            }
        }
    }
    // Fallback: check video's direct height field
    if max_height == 0 {
        max_height = json_val["height"].as_u64().unwrap_or(1080);
    }

    println!("Detected max video height: {}p", max_height);

    // Build dynamic format list based on max height
    let mut formats: Vec<String> = vec!["Best".to_string()];
    if max_height >= 4320 {
        formats.push("8K".to_string());
    }
    if max_height >= 2160 {
        formats.push("4K".to_string());
    }
    if max_height >= 1440 {
        formats.push("1440p".to_string());
    }
    if max_height >= 1080 {
        formats.push("1080p".to_string());
    }
    if max_height >= 720 {
        formats.push("720p".to_string());
    }
    if max_height >= 480 {
        formats.push("480p".to_string());
    }

    // Extract preview_url
    let mut preview_url = None;

    if !is_youtube {
        // If we downloaded it, the filename is the path
        if let Some(path) = json_val["filename"].as_str() {
            preview_url = Some(path.to_string());
        }
    }

    // Fallback (for YouTube or if download didn't return filename)
    if preview_url.is_none() {
        // Existing logic: find best mp4 url
        if let Some(formats_arr) = json_val["formats"].as_array() {
            for fmt in formats_arr.iter().rev() {
                if let Some(url) = fmt["url"].as_str() {
                    if url.starts_with("http") {
                        preview_url = Some(url.to_string());
                        break;
                    }
                }
            }
        }
    }

    // Final fallback
    if preview_url.is_none() {
        preview_url = json_val["url"].as_str().map(|s| s.to_string());
    }

    Ok(VideoMetadata {
        title,
        duration,
        formats,
        preview_url,
    })
}

#[tauri::command]
async fn set_download_path(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let mut path_lock = state
        .download_path
        .lock()
        .map_err(|_| "Failed to lock state")?;
    *path_lock = Some(PathBuf::from(path));
    Ok(())
}

#[tauri::command]
async fn get_download_path(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let path_lock = state
        .download_path
        .lock()
        .map_err(|_| "Failed to lock state")?;
    if let Some(ref path) = *path_lock {
        return Ok(path.to_string_lossy().to_string());
    }
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("Failed to get download dir: {}", e))?;
    let default_path = download_dir.join("Clipme");
    Ok(default_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn check_onboarding_complete(app: AppHandle) -> Result<bool, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;
    let onboarding_file = config_dir.join("onboarding_complete");
    Ok(onboarding_file.exists())
}

#[tauri::command]
async fn set_onboarding_complete(app: AppHandle) -> Result<(), String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    let onboarding_file = config_dir.join("onboarding_complete");
    fs::write(&onboarding_file, "1")
        .map_err(|e| format!("Failed to write onboarding file: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn reset_app(app: AppHandle) -> Result<(), String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    // Remove onboarding file
    let onboarding_file = config_dir.join("onboarding_complete");
    if onboarding_file.exists() {
        fs::remove_file(&onboarding_file).ok();
    }

    // Remove license file
    let license_file = config_dir.join("license.json");
    if license_file.exists() {
        fs::remove_file(&license_file).ok();
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Default, Debug, Clone)]
pub struct AppSettings {
    pub preferred_quality: Option<String>,
}

#[tauri::command]
async fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;
    let settings_file = config_dir.join("settings.json");

    if !settings_file.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&settings_file)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    let settings: AppSettings = serde_json::from_str(&content).unwrap_or_default();

    Ok(settings)
}

#[tauri::command]
async fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    let settings_file = config_dir.join("settings.json");
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_file, content).map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}

// License verification structures
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LicenseInfo {
    pub is_valid: bool,
    pub is_pro: bool,
    pub license_key: Option<String>,
    pub email: Option<String>,
}

impl Default for LicenseInfo {
    fn default() -> Self {
        LicenseInfo {
            is_valid: false,
            is_pro: false,
            license_key: None,
            email: None,
        }
    }
}

const GUMROAD_PRODUCT_ID: &str = "VkMvNrW6QMqbIgvlt4L6xw==";

#[tauri::command]
async fn verify_license(app: AppHandle, license_key: String) -> Result<LicenseInfo, String> {
    println!("Verifying license: {}", license_key);

    // Use async reqwest client
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.gumroad.com/v2/licenses/verify")
        .form(&[
            ("product_id", GUMROAD_PRODUCT_ID),
            ("license_key", license_key.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to verify license: {}", e))?;

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    println!("Gumroad response: {:?}", json);

    let success = json["success"].as_bool().unwrap_or(false);

    if success {
        let purchase = &json["purchase"];
        let email = purchase["email"].as_str().map(String::from);
        let refunded = purchase["refunded"].as_bool().unwrap_or(false);
        let subscription_ended = purchase["subscription_ended_at"].as_str().is_some();
        let cancelled =
            purchase["subscription_cancelled_at"].as_str().is_some() && subscription_ended;

        // License is valid if not refunded and subscription hasn't ended
        let is_valid = !refunded && !cancelled;

        let license_info = LicenseInfo {
            is_valid,
            is_pro: is_valid,
            license_key: Some(license_key.clone()),
            email,
        };

        // Store license if valid
        if is_valid {
            let config_dir = app
                .path()
                .app_config_dir()
                .map_err(|e| format!("Failed to get config dir: {}", e))?;
            if !config_dir.exists() {
                fs::create_dir_all(&config_dir)
                    .map_err(|e| format!("Failed to create config dir: {}", e))?;
            }
            let license_file = config_dir.join("license.json");
            let json_str = serde_json::to_string(&license_info)
                .map_err(|e| format!("Failed to serialize license: {}", e))?;
            fs::write(&license_file, json_str)
                .map_err(|e| format!("Failed to save license: {}", e))?;
        }

        Ok(license_info)
    } else {
        let message = json["message"].as_str().unwrap_or("Invalid license key");
        Err(message.to_string())
    }
}

#[tauri::command]
async fn get_license_status(app: AppHandle) -> Result<LicenseInfo, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;
    let license_file = config_dir.join("license.json");

    if license_file.exists() {
        let content = fs::read_to_string(&license_file)
            .map_err(|e| format!("Failed to read license: {}", e))?;
        let license_info: LicenseInfo = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse license: {}", e))?;
        Ok(license_info)
    } else {
        Ok(LicenseInfo::default())
    }
}

#[tauri::command]
async fn clear_license(app: AppHandle) -> Result<(), String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;
    let license_file = config_dir.join("license.json");
    if license_file.exists() {
        fs::remove_file(&license_file).map_err(|e| format!("Failed to remove license: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn cancel_download(state: State<'_, AppState>) -> Result<(), String> {
    println!("Cancelling download...");
    let mut pid_lock = state
        .download_pid
        .lock()
        .map_err(|_| "Failed to lock state")?;
    if let Some(pid) = *pid_lock {
        println!("Killing process {}", pid);
        #[cfg(not(windows))]
        {
            let _ = Command::new("kill").arg(pid.to_string()).output();
        }
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(&["/F", "/PID", &pid.to_string()])
                .output();
        }
    }

    {
        let mut file_lock = state
            .current_file_path
            .lock()
            .map_err(|_| "Failed to lock state")?;
        if let Some(ref path) = *file_lock {
            println!("Cleaning up file: {:?}", path);
            // Delete main file
            let _ = fs::remove_file(path);

            let path_str = path.to_string_lossy().to_string();

            // Delete .part files
            let _ = fs::remove_file(format!("{}.part", path_str));

            // Delete .temp.mp4 variant (from two-step transcode)
            if path_str.ends_with(".mp4") {
                let temp_path = path_str.replace(".mp4", ".temp.mp4");
                println!("Cleaning up temp file: {}", temp_path);
                let _ = fs::remove_file(&temp_path);
                let _ = fs::remove_file(format!("{}.part", temp_path));
            }

            // Delete extension.part variant
            if let Some(extension) = path.extension() {
                let mut ext_str = extension.to_string_lossy().to_string();
                ext_str.push_str(".part");
                let mut part_path = path.clone();
                part_path.set_extension(ext_str);
                let _ = fs::remove_file(&part_path);
            }
        }
        *file_lock = None;
    }
    *pid_lock = None;
    Ok(())
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn parse_ffmpeg_time(time_str: &str) -> Option<f64> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() == 3 {
        let h = parts[0].parse::<f64>().ok()?;
        let m = parts[1].parse::<f64>().ok()?;
        let s = parts[2].parse::<f64>().ok()?;
        return Some(h * 3600.0 + m * 60.0 + s);
    }
    None
}

// Helper to read until \n or \r
fn read_until_delimiter<R: Read>(
    mut reader: R,
    delimiter: u8,
    delimiter2: u8,
) -> impl Iterator<Item = String> {
    let mut buffer = Vec::new();
    let mut byte = [0u8; 1];

    std::iter::from_fn(move || {
        loop {
            match reader.read(&mut byte) {
                Ok(0) => {
                    // EOF
                    if !buffer.is_empty() {
                        let res = String::from_utf8_lossy(&buffer).to_string();
                        buffer.clear();
                        return Some(res);
                    }
                    return None;
                }
                Ok(_) => {
                    let b = byte[0];
                    if b == delimiter || b == delimiter2 {
                        let res = String::from_utf8_lossy(&buffer).trim().to_string();
                        buffer.clear();
                        if !res.is_empty() {
                            return Some(res);
                        }
                        // If empty (e.g. \r\n), just continue
                    } else {
                        buffer.push(b);
                    }
                }
                Err(_) => return None,
            }
        }
    })
}

#[tauri::command]
async fn download_clip(
    app: AppHandle,
    state: State<'_, AppState>,
    url: String,
    title: String,
    start: f64,
    end: f64,
    quality: String,
    format: String,
    id: u64,
) -> Result<String, String> {
    println!(
        "Processing clip: {} ({}-{}) Quality: {} Format: {} ID: {}",
        url, start, end, quality, format, id
    );

    // Get sidecar paths
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    let ytdlp_path = get_ytdlp_path(&app)?;

    let safe_title = sanitize_filename(&title);
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Setup path
    let output_dir = {
        let path_lock = state
            .download_path
            .lock()
            .map_err(|_| "Failed to lock state")?;
        if let Some(ref custom_path) = *path_lock {
            custom_path.clone()
        } else {
            app.path()
                .download_dir()
                .map_err(|e| e.to_string())?
                .join("YT_Clipper")
        }
    };
    if !output_dir.exists() {
        std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    }

    // Use selected format for extension
    let ext = if format.is_empty() {
        "mp4".to_string()
    } else {
        format.to_lowercase()
    };
    let filename = format!("{}_clip_{}.{}", safe_title, timestamp, ext);
    let output_path = output_dir.join(&filename);
    let output_path_str = output_path.to_string_lossy().to_string();

    {
        let mut file_lock = state
            .current_file_path
            .lock()
            .map_err(|_| "Failed to lock state")?;
        *file_lock = Some(output_path.clone());
    }

    let is_local_file = std::path::Path::new(&url).exists();
    let total_duration = end - start;

    if is_local_file {
        println!("Local file clipping mode");

        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                percent: 0.0,
                speed: "Processing".to_string(),
                eta: "Starting".to_string(),
                downloaded: "0%".to_string(),
                total: "".to_string(),
                id,
            },
        );

        let mut ffmpeg_args = vec![
            "-y".to_string(),
            "-i".to_string(),
            url.clone(),
            "-ss".to_string(),
            start.to_string(),
            "-t".to_string(),
            total_duration.to_string(),
        ];

        let mut video_filters = Vec::new();

        match quality.as_str() {
            "8K" => {
                video_filters.push("scale=-2:4320".to_string());
            }
            "4K" => {
                video_filters.push("scale=-2:2160".to_string());
            }
            "1440p" => {
                video_filters.push("scale=-2:1440".to_string());
            }
            "1080p" => {
                video_filters.push("scale=-2:1080".to_string());
            }
            "720p" => {
                video_filters.push("scale=-2:720".to_string());
            }
            "480p" => {
                video_filters.push("scale=-2:480".to_string());
            }
            "Audio Only" => {
                ffmpeg_args.push("-vn".to_string());
            }
            _ => {}
        };

        if !video_filters.is_empty() && quality != "Audio Only" {
            ffmpeg_args.push("-vf".to_string());
            ffmpeg_args.push(video_filters.join(","));
        }

        if quality != "Audio Only" {
            // Codec selection based on format
            if ext == "webm" {
                ffmpeg_args.extend(vec![
                    "-c:v".to_string(),
                    "libvpx-vp9".to_string(),
                    "-b:v".to_string(),
                    "0".to_string(),
                    "-crf".to_string(),
                    "30".to_string(),
                    "-c:a".to_string(),
                    "libopus".to_string(),
                ]);
            } else {
                // Default to H.264 / AAC for everything else (mp4, mov, mkv, avi)
                ffmpeg_args.extend(vec![
                    "-c:v".to_string(),
                    "libx264".to_string(),
                    "-preset".to_string(),
                    "fast".to_string(),
                    "-crf".to_string(),
                    "23".to_string(),
                    "-c:a".to_string(),
                    "aac".to_string(),
                    "-b:a".to_string(),
                    "192k".to_string(),
                ]);
            }
        }

        ffmpeg_args.push(output_path_str.clone());

        println!("Running FFmpeg: {:?}", ffmpeg_args);

        let mut child = Command::new(&ffmpeg_path)
            .args(&ffmpeg_args)
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start ffmpeg: {}", e))?;

        let pid = child.id();
        {
            let mut pid_lock = state
                .download_pid
                .lock()
                .map_err(|_| "Failed to lock state")?;
            *pid_lock = Some(pid);
        }

        let app_clone = app.clone();
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            std::thread::spawn(move || {
                for line in read_until_delimiter(reader, b'\r', b'\n') {
                    if let Some(mut progress) = parse_ffmpeg_progress(&line, total_duration) {
                        progress.id = id;
                        progress.speed = "Clipping/Encoding".to_string();
                        let _ = app_clone.emit("download-progress", progress);
                    }
                }
            });
        }

        let status = child
            .wait()
            .map_err(|e| format!("Failed to wait on ffmpeg: {}", e))?;

        {
            let mut pid_lock = state
                .download_pid
                .lock()
                .map_err(|_| "Failed to lock state")?;
            *pid_lock = None;
        }

        if !status.success() {
            return Err("Local clip encoding failed".to_string());
        }

        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                percent: 100.0,
                speed: "Done".to_string(),
                eta: "00:00".to_string(),
                downloaded: "100%".to_string(),
                total: "".to_string(),
                id,
            },
        );

        return Ok("Local clip complete".to_string());
    }

    // --- YT-DLP LOGIC FOR REMOTE URLS ---

    let section_range = format!("*{}-{}", start, end);

    let format_arg = match quality.as_str() {
        "8K" => "bestvideo[height>=4320]+bestaudio/bestvideo[height>=2160]+bestaudio/best",
        "4K" => "bestvideo[height=2160]+bestaudio/bestvideo[height>=2160]+bestaudio/best",
        "1440p" => "bestvideo[height=1440]+bestaudio/bestvideo[height<=1440]+bestaudio/best",
        "1080p" => "bestvideo[height=1080][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height=1080]+bestaudio/best[height<=1080]",
        "720p" => "bestvideo[height=720][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height=720]+bestaudio/best[height<=720]",
        "480p" => "bestvideo[height=480][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height=480]+bestaudio/best[height<=480]",
        "Audio Only" => "bestaudio/best",
        _ => "bestvideo+bestaudio/best", 
    };

    let is_high_res = quality == "8K" || quality == "4K" || quality == "1440p" || quality == "Best";

    // For high-res remote, we typically download then transcode to HEVC.
    // If output format is NOT MP4/MKV/MOV, HEVC might be weird.
    // But let's assume if user picks AVI/WebM + 4K, they know what they are doing.
    // Actually yt-dlp might struggle to merge into AVI directly.
    // Let's rely on yt-dlp `--merge-output-format`.

    let (download_path, final_path) = if is_high_res {
        // Intermediate likely needs to be mp4 or mkv to hold high res safely before we transcode
        // OR we just download to `temp.{ext}` directly.
        let temp_path = output_path.with_extension(format!("temp.{}", ext));
        (
            temp_path.to_string_lossy().to_string(),
            output_path_str.clone(),
        )
    } else {
        (output_path_str.clone(), output_path_str.clone())
    };

    println!("Outputting to: {} (final: {})", download_path, final_path);
    let progress_template = "PROGRESS|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_estimate_str)s";

    let mut args = vec![
        "--download-sections".to_string(),
        section_range,
        "-o".to_string(),
        download_path.clone(),
        "-f".to_string(),
        format_arg.to_string(),
        "--merge-output-format".to_string(),
        ext.to_string(), // Use the requested format
        "--newline".to_string(),
        "--concurrent-fragments".to_string(),
        "8".to_string(),
        "--progress-template".to_string(),
        progress_template.to_string(),
    ];

    args.push(url);

    let mut child = Command::new(&ytdlp_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start download: {}", e))?;

    let pid = child.id();
    {
        let mut pid_lock = state
            .download_pid
            .lock()
            .map_err(|_| "Failed to lock state")?;
        *pid_lock = Some(pid);
    }

    let app_clone1 = app.clone();
    let app_clone2 = app.clone();

    // READ STDOUT (yt-dlp native)
    // yt-dlp with --newline sends \n
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let id_clone = id;
        std::thread::spawn(move || {
            for line in reader.lines().map_while(Result::ok) {
                // println!("STDOUT: {}", line);
                if line.starts_with("PROGRESS|") {
                    if let Some(mut progress) = parse_progress_template(&line) {
                        // Scale to 50% for high-res (download phase)
                        progress.percent = progress.percent * 0.5;
                        progress.id = id_clone;
                        let _ = app_clone1.emit("download-progress", progress);
                    }
                }
            }
        });
    }

    // READ STDERR (ffmpeg during merge or yt-dlp fragment progress)
    if let Some(stderr) = child.stderr.take() {
        let id_clone = id; // Clone ID for thread
        std::thread::spawn(move || {
            for line in read_until_delimiter(stderr, b'\r', b'\n') {
                if line.contains("time=") && line.contains("bitrate=") {
                    // This is ffmpeg progress
                    if let Some(mut progress) = parse_ffmpeg_progress(&line, total_duration) {
                        progress.percent = progress.percent * 0.5;
                        progress.id = id_clone;
                        let _ = app_clone2.emit("download-progress", progress);
                    }
                } else if line.contains("frag") {
                    // If we see frag, it means download is happening, just maybe not typical status line
                    // We can emit a generic progress update here if needed, but for now, rely on stdout.
                }
            }
        });
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait on download: {}", e))?;

    {
        let mut pid_lock = state
            .download_pid
            .lock()
            .map_err(|_| "Failed to lock state")?;
        *pid_lock = None;
    }

    if !status.success() {
        return Err("Download failed".to_string());
    }

    // Emit final progress for download phase
    let _ = app.emit(
        "download-progress",
        DownloadProgress {
            percent: if is_high_res { 50.0 } else { 100.0 },
            speed: "Complete".to_string(),
            eta: "Done".to_string(),
            downloaded: "100%".to_string(),
            total: "".to_string(),
            id,
        },
    );

    // Step 2: Transcode to HEVC for high-res
    if is_high_res {
        println!("Starting HEVC transcoding...");
        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                percent: 50.0,
                speed: "Encoding".to_string(),
                eta: "Transcoding".to_string(),
                downloaded: "50%".to_string(),
                total: "".to_string(),
                id,
            },
        );

        #[cfg(target_os = "macos")]
        let ffmpeg_args = vec![
            "-y",
            "-i",
            &download_path,
            "-c:v",
            "hevc_videotoolbox",
            "-tag:v",
            "hvc1",
            "-b:v",
            "12M",
            "-c:a",
            "aac",
            &final_path,
        ];

        #[cfg(target_os = "windows")]
        let ffmpeg_args = vec![
            "-y",
            "-i",
            &download_path,
            "-c:v",
            "libx265",
            "-crf",
            "23",
            "-preset",
            "medium",
            "-tag:v",
            "hvc1",
            "-c:a",
            "aac",
            &final_path,
        ];

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let ffmpeg_args = vec![
            "-y",
            "-i",
            &download_path,
            "-c:v",
            "libx265",
            "-crf",
            "23",
            "-preset",
            "medium",
            "-tag:v",
            "hvc1",
            "-c:a",
            "aac",
            &final_path,
        ];

        let mut transcode_child = Command::new(&ffmpeg_path)
            .args(&ffmpeg_args)
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start ffmpeg transcoding: {}", e))?;

        let transcode_pid = transcode_child.id();
        {
            let mut pid_lock = state
                .download_pid
                .lock()
                .map_err(|_| "Failed to lock state")?;
            *pid_lock = Some(transcode_pid);
        }

        // Parse ffmpeg transcoding progress
        let app_clone3 = app.clone();
        let id_clone = id;
        if let Some(stderr) = transcode_child.stderr.take() {
            let reader = BufReader::new(stderr);
            std::thread::spawn(move || {
                // FFmpeg uses \r for progress updates
                for line in read_until_delimiter(reader, b'\r', b'\n') {
                    let duration_clone = total_duration;
                    if let Some(mut progress) = parse_ffmpeg_progress(&line, duration_clone) {
                        // Update ID
                        progress.id = id_clone;
                        // Scale from 50-100% for transcode phase
                        progress.percent = 50.0 + (progress.percent * 0.5);
                        progress.speed = "Encoding".to_string();
                        let _ = app_clone3.emit("download-progress", progress);
                    }
                }
            });
        }

        let transcode_output = transcode_child
            .wait()
            .map_err(|e| format!("Failed to wait on transcode: {}", e))?;

        {
            let mut pid_lock = state
                .download_pid
                .lock()
                .map_err(|_| "Failed to lock state")?;
            *pid_lock = None;
        }

        // Clean up temp file
        let _ = fs::remove_file(&download_path);

        if !transcode_output.success() {
            return Err("Transcoding failed".to_string());
        }
    }

    {
        let mut file_lock = state
            .current_file_path
            .lock()
            .map_err(|_| "Failed to lock state")?;
        *file_lock = None;
    }

    let _ = app.emit(
        "download-progress",
        DownloadProgress {
            percent: 100.0,
            speed: "Done".to_string(),
            eta: "00:00".to_string(),
            downloaded: "100%".to_string(),
            total: "".to_string(),
            id,
        },
    );

    Ok("Download complete".to_string())
}

fn parse_progress_template(line: &str) -> Option<DownloadProgress> {
    let parts: Vec<&str> = line.split('|').collect();
    if parts.len() < 5 {
        return None;
    }

    let percent = parts[1]
        .trim()
        .trim_end_matches('%')
        .parse::<f64>()
        .unwrap_or(0.0);
    let speed = parts[2].trim().to_string();
    let eta = parts[3].trim().to_string();
    let total = parts[4].trim().to_string();

    let speed = if speed == "NA" {
        "Calculating...".to_string()
    } else {
        speed
    };
    let eta = if eta == "NA" {
        "--:--".to_string()
    } else {
        eta
    };

    Some(DownloadProgress {
        percent,
        speed,
        eta,
        downloaded: format!("{}%", percent),
        total,
        id: 0, // Placeholder
    })
}

fn parse_ffmpeg_progress(line: &str, total_duration: f64) -> Option<DownloadProgress> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    let mut current_time = 0.0;
    let mut speed = "0 kbits/s".to_string();

    for part in parts {
        if part.starts_with("time=") {
            let val = part.trim_start_matches("time=");
            current_time = parse_ffmpeg_time(val).unwrap_or(0.0);
        }
        if part.starts_with("bitrate=") {
            speed = part.trim_start_matches("bitrate=").to_string();
        }
    }

    if total_duration > 0.0 {
        let percent = (current_time / total_duration) * 100.0;
        let percent = if percent > 100.0 { 100.0 } else { percent };

        Some(DownloadProgress {
            percent,
            speed,
            eta: "Encoding".to_string(),
            downloaded: format!("{:.1}s", current_time),
            total: format!("{:.1}s", total_duration),
            id: 0, // Placeholder, will be overwritten by caller
        })
    } else {
        None
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            download_pid: Mutex::new(None),
            download_path: Mutex::new(None),
            current_file_path: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_video_metadata,
            download_clip,
            cancel_download,
            set_download_path,
            get_download_path,
            check_onboarding_complete,
            set_onboarding_complete,
            reset_app,
            verify_license,
            get_license_status,
            clear_license,
            get_app_settings,
            save_app_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

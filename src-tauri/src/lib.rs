use tauri::AppHandle;
use tauri::Manager;
use tauri::State;
use std::process::Command;
use serde::{Serialize, Deserialize};
use std::sync::Mutex;

struct AppState {
    download_pid: Mutex<Option<u32>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VideoMetadata {
    title: String,
    duration: f64,
    formats: Vec<String>, // simplified list of available qualities
}

#[tauri::command]
async fn get_video_metadata(url: String) -> Result<VideoMetadata, String> {
    println!("Fetching metadata for: {}", url);
    
    // Check if yt-dlp is installed
    let status_check = Command::new("yt-dlp").arg("--version").output();
    if status_check.is_err() {
        return Err("yt-dlp not found. Please install it.".to_string());
    }

    let output = Command::new("yt-dlp")
        .args(&["--dump-json", "--flat-playlist", "--no-warnings", &url])
        .output()
        .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json_val: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let title = json_val["title"].as_str().unwrap_or("Unknown Title").to_string();
    let duration = json_val["duration"].as_f64().unwrap_or(0.0);
    
    // Simplified logic: assume common resolutions are available if duration > 0.
    // Parsing real formats from dump-json is heavy.
    // We will provide a static list for the UI: "Best", "4K", "1440p", "1080p", "720p", "480p", "Audio Only"
    // The backend just needs to handle them.
    let formats = vec![
        "Best".to_string(),
        "4K".to_string(),
        "1440p".to_string(),
        "1080p".to_string(), 
        "720p".to_string(), 
        "480p".to_string(),
        "Audio Only".to_string()
    ];

    Ok(VideoMetadata { title, duration, formats })
}

#[tauri::command]
async fn cancel_download(state: State<'_, AppState>) -> Result<(), String> {
    println!("Cancelling download...");
    let mut pid_lock = state.download_pid.lock().map_err(|_| "Failed to lock state")?;
    
    if let Some(pid) = *pid_lock {
        println!("Killing process {}", pid);
        #[cfg(not(windows))]
        {
            Command::new("kill")
                .arg(pid.to_string())
                .output()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(windows)]
        {
            Command::new("taskkill")
                .args(&["/F", "/PID", &pid.to_string()])
                .output()
                .map_err(|e| e.to_string())?;
        }
    }
    
    // Clear PID
    *pid_lock = None;
    Ok(())
}

#[tauri::command]
async fn download_clip(app: AppHandle, state: State<'_, AppState>, url: String, start: f64, end: f64, quality: String) -> Result<String, String> {
    println!("Downloading clip: {} ({}-{}) Quality: {}", url, start, end, quality);

    // Get downloads directory
    let download_dir = app.path().download_dir()
        .map_err(|e| format!("Failed to get download dir: {}", e))?;
    
    // Construct output template
    // We'll put it in a "YT Clipper" subdirectory if possible, or just root
    let output_path = download_dir.join("YT_Clipper");
    if !output_path.exists() {
        std::fs::create_dir_all(&output_path).map_err(|e| e.to_string())?;
    }
    
    // Template: "Title - [start-end].ext"
    // yt-dlp handles extension auto
    // Note: yt-dlp -o takes a template.
    // We want the filename to include timestamps to avoid overwrite? 
    // Or just Title. content_id is safer.
    // Let's use Title_Timestamp.
    
    let output_template = output_path.join("%(title)s_clip_%(epoch)s.%(ext)s");
    let output_template_str = output_template.to_string_lossy().to_string();

    // Note: yt-dlp generic syntax is *start-end.
    // Docs: --download-sections "*10:15-10:30"
    
    let section_range = format!("*{}-{}", start, end);
    
    // Determine format flag
    // We prioritize AVC (h264) and AAC (m4a) for QuickTime compatibility.
    // Fallback to "best" if specific codec not found.
    // Note: 4K/1440p usually requires VP9/AV1, so we must allow those for high res.
    // We remove [vcodec^=avc] for 4K/1440p to ensure we actually get the resolution.
    let format_arg = match quality.as_str() {
        "4K" => "bestvideo[height=2160]+bestaudio/bestvideo[height>1080]+bestaudio/best",
        "1440p" => "bestvideo[height=1440]+bestaudio/bestvideo[height>1080]+bestaudio/best",
        "1080p" => "bestvideo[height=1080][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height=1080]+bestaudio/best[height<=1080]",
        "720p" => "bestvideo[height=720][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height=720]+bestaudio/best[height<=720]",
        "480p" => "bestvideo[height=480][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height=480]+bestaudio/best[height<=480]",
        "Audio Only" => "bestaudio/best",
        _ => "bestvideo[vcodec^=avc]+bestaudio[ext=m4a]/best", // Default "Best", try AVC first
    };

    // Spawn command instead of output() to get ID
    let mut child = Command::new("yt-dlp")
        // .args(&["--download-sections", &section_range, "-o", &output_template_str, &url])
        // Force mp4 for compatibility if needed, or let it decide best. format: bestvideo+bestaudio/best
        // Let's force mp4 container if possible to avoid mkv
        .args(&[
            "--download-sections", &section_range, 
            "-o", &output_template_str,
            "-f", format_arg,
            "--merge-output-format", "mp4",
            &url
        ])
        .spawn()
        .map_err(|e| format!("Failed to start download: {}", e))?;

    let pid = child.id();
    
    // Store PID
    {
        let mut pid_lock = state.download_pid.lock().map_err(|_| "Failed to lock state")?;
        *pid_lock = Some(pid);
    }

    // Wait for output
    // Note: If killed, wait_with_output might return error or exit code.
    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait on download: {}", e))?;
    
    // Clear PID
    {
        let mut pid_lock = state.download_pid.lock().map_err(|_| "Failed to lock state")?;
        *pid_lock = None;
    }

    // Check successful exit (if cancelled, might be signal kill)
    if !output.status.success() {
        // If it was validly killed, maybe accept it? 
        // But for now return error so UI knows it didn't finish cleanly.
        // Actually if cancelled, user expects it to stop.
        // We can check exit code.
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Download failed/cancelled: {}", stderr));
    }

    Ok("Download complete".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { download_pid: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![get_video_metadata, download_clip, cancel_download])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub tags: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_pinned: bool,
}

pub struct DbState(pub Mutex<Connection>);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extract_title(content: &str) -> String {
    let first_line = content
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("");
    let trimmed = first_line.trim();
    if trimmed.is_empty() {
        "Untitled Note".to_string()
    } else {
        trimmed.chars().take(80).collect()
    }
}

fn extract_tags(content: &str) -> String {
    let tags: Vec<String> = content
        .split_whitespace()
        .filter(|w| w.starts_with('#') && w.len() > 1)
        .map(|w| {
            w.trim_start_matches('#')
                .trim_matches(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
                .to_lowercase()
        })
        .filter(|t| !t.is_empty())
        .collect();

    serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string())
}

// ---------------------------------------------------------------------------
// Note Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_notes(db: State<'_, DbState>) -> Result<Vec<Note>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, tags, created_at, updated_at, is_pinned 
             FROM notes 
             ORDER BY is_pinned DESC, updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let note_iter = stmt
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                tags: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                is_pinned: row.get::<_, bool>(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for note in note_iter {
        notes.push(note.map_err(|e| e.to_string())?);
    }
    Ok(notes)
}

#[tauri::command]
fn list_notes(db: State<'_, DbState>) -> Result<Vec<Note>, String> {
    get_notes(db)
}

#[tauri::command]
fn create_note(content: String, db: State<'_, DbState>) -> Result<Note, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let title = extract_title(&content);
    let tags = extract_tags(&content);

    conn.execute(
        "INSERT INTO notes (title, content, tags, is_pinned) VALUES (?1, ?2, ?3, 0)",
        params![title, content, tags],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, tags, created_at, updated_at, is_pinned 
             FROM notes WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let note = stmt
        .query_row(params![id], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                tags: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                is_pinned: row.get::<_, bool>(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(note)
}

#[tauri::command]
fn update_note(id: i64, content: String, db: State<'_, DbState>) -> Result<Note, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let title = extract_title(&content);
    let tags = extract_tags(&content);

    conn.execute(
        "UPDATE notes 
         SET title = ?1, content = ?2, tags = ?3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?4",
        params![title, content, tags, id],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, tags, created_at, updated_at, is_pinned 
             FROM notes WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let note = stmt
        .query_row(params![id], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                tags: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                is_pinned: row.get::<_, bool>(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(note)
}

#[tauri::command]
fn delete_note(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn search_notes(query: String, db: State<'_, DbState>) -> Result<Vec<Note>, String> {
    let q = query.trim();
    if q.is_empty() {
        return get_notes(db);
    }

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", q);
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, tags, created_at, updated_at, is_pinned 
             FROM notes 
             WHERE title LIKE ?1 OR content LIKE ?1 OR tags LIKE ?1 
             ORDER BY is_pinned DESC, updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let note_iter = stmt
        .query_map(params![pattern], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                tags: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                is_pinned: row.get::<_, bool>(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for note in note_iter {
        notes.push(note.map_err(|e| e.to_string())?);
    }
    Ok(notes)
}

#[tauri::command]
fn toggle_pin_note(id: i64, db: State<'_, DbState>) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET is_pinned = NOT is_pinned, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    let is_pinned: bool = conn
        .query_row(
            "SELECT is_pinned FROM notes WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(is_pinned)
}

// ---------------------------------------------------------------------------
// Settings Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_settings(db: State<'_, DbState>) -> Result<HashMap<String, String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    for item in rows {
        let (k, v) = item.map_err(|e| e.to_string())?;
        map.insert(k, v);
    }
    Ok(map)
}

#[tauri::command]
fn update_setting(key: String, value: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) 
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn register_shortcut(shortcut: String, app: AppHandle) -> Result<(), String> {
    let clean = shortcut.to_lowercase().replace(' ', "");
    if let Ok(sc) = clean.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister_all();
        app.global_shortcut().register(sc).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_autostart(enabled: bool, app: AppHandle) -> Result<(), String> {
    let autostart_mgr = app.autolaunch();
    if enabled {
        let _ = autostart_mgr.enable();
    } else {
        let _ = autostart_mgr.disable();
    }
    Ok(())
}

#[tauri::command]
fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// AI Completion Command
// ---------------------------------------------------------------------------

#[tauri::command]
async fn generate_ai_response(
    prompt: String,
    context: String,
    db: State<'_, DbState>,
) -> Result<String, String> {
    let (provider, endpoint, api_key, model) = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let get_val = |k: &str, def: &str| -> String {
            conn.query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![k],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| def.to_string())
        };

        (
            get_val("ai_provider", "ollama"),
            get_val("ai_endpoint", "http://localhost:11434"),
            get_val("ai_api_key", ""),
            get_val("ai_model", "llama3"),
        )
    };

    let user_message = if context.trim().is_empty() {
        prompt.clone()
    } else {
        format!("Task: {}\n\nNote:\n\"\"\"\n{}\n\"\"\"", prompt, context)
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    if provider.to_lowercase() == "anthropic" {
        // Native Anthropic Messages API
        let base = endpoint.trim().trim_end_matches('/');
        let url = if base.ends_with("/messages") {
            base.to_string()
        } else if base.ends_with("/v1") {
            format!("{}/messages", base)
        } else {
            format!("{}/v1/messages", base)
        };

        let body = serde_json::json!({
            "model": model,
            "max_tokens": 2048,
            "system": "You are QNotes AI Assistant. Help the user process, summarize, or improve quick notes. Output only the requested result concisely and clearly, without unnecessary conversational filler.",
            "messages": [
                {
                    "role": "user",
                    "content": user_message
                }
            ]
        });

        let mut req = client.post(&url)
            .header("content-type", "application/json")
            .header("anthropic-version", "2023-06-01");

        if !api_key.trim().is_empty() {
            req = req.header("x-api-key", api_key.trim());
        }

        let resp = req.json(&body).send().await.map_err(|e| {
            format!("Connection failed to {}: {}", url, e)
        })?;

        let status = resp.status();
        let resp_text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(format!("Anthropic API error ({}): {}", status, resp_text));
        }

        let val: serde_json::Value = serde_json::from_str(&resp_text).map_err(|e| {
            format!("Failed to parse response JSON: {}", e)
        })?;

        if let Some(text) = val["content"][0]["text"].as_str() {
            Ok(text.trim().to_string())
        } else {
            Err(format!("Could not extract text from Anthropic response: {}", resp_text))
        }
    } else {
        // OpenAI-compatible /v1/chat/completions (OpenAI, Ollama, LM Studio, etc.)
        let base = endpoint.trim().trim_end_matches('/');
        let url = if base.ends_with("/chat/completions") {
            base.to_string()
        } else if base.ends_with("/v1") {
            format!("{}/chat/completions", base)
        } else {
            format!("{}/v1/chat/completions", base)
        };

        let body = serde_json::json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are QNotes AI Assistant. Help the user process, summarize, or improve quick notes. Output only the requested result concisely and clearly, without unnecessary conversational filler."
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ]
        });

        let mut req = client.post(&url)
            .header("content-type", "application/json");

        if !api_key.trim().is_empty() {
            req = req.header("authorization", format!("Bearer {}", api_key.trim()));
        }

        let resp = req.json(&body).send().await.map_err(|e| {
            format!("Connection failed to {}: {}", url, e)
        })?;

        let status = resp.status();
        let resp_text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(format!("AI server returned HTTP {}: {}", status, resp_text));
        }

        let val: serde_json::Value = serde_json::from_str(&resp_text).map_err(|e| {
            format!("Failed to parse response JSON: {}", e)
        })?;

        if let Some(content) = val["choices"][0]["message"]["content"].as_str() {
            Ok(content.trim().to_string())
        } else {
            Err(format!("Could not extract content from AI response: {}", resp_text))
        }
    }
}

// ---------------------------------------------------------------------------
// App Entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Setup SQLite Database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            let _ = std::fs::create_dir_all(&app_data_dir);
            let db_path = app_data_dir.join("qnotes.db");
            let conn = Connection::open(&db_path).map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            // Notes table
            conn.execute(
                "CREATE TABLE IF NOT EXISTS notes (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    title       TEXT     NOT NULL DEFAULT '',
                    content     TEXT     NOT NULL DEFAULT '',
                    tags        TEXT     NOT NULL DEFAULT '[]',
                    created_at  DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
                    updated_at  DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
                    is_pinned   BOOLEAN  NOT NULL DEFAULT 0
                );",
                [],
            )?;

            // Settings table
            conn.execute(
                "CREATE TABLE IF NOT EXISTS settings (
                    key   TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );",
                [],
            )?;

            // Default settings
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES 
                    ('is_first_run', 'true'),
                    ('autostart', 'true'),
                    ('shortcut', 'Alt+Space'),
                    ('theme', 'midnight'),
                    ('ai_provider', 'ollama'),
                    ('ai_endpoint', 'http://localhost:11434'),
                    ('ai_api_key', ''),
                    ('ai_model', 'llama3');",
                [],
            )?;

            // Safe schema migrations
            let _ = conn.execute("ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT '';", []);
            let _ = conn.execute("ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';", []);
            let _ = conn.execute("ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;", []);

            // Read shortcut from settings to register
            let current_shortcut: String = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'shortcut'",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or_else(|_| "Alt+Space".to_string());

            let clean_sc = current_shortcut.to_lowercase().replace(' ', "");
            if let Ok(sc) = clean_sc.parse::<Shortcut>() {
                let _ = app.global_shortcut().register(sc);
            }

            app.manage(DbState(Mutex::new(conn)));

            Ok(())
        })
        .on_window_event(|window, event| {
            // Auto-hide when window loses focus (Spotlight style blur event)
            if let WindowEvent::Focused(false) = event {
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_notes,
            list_notes,
            create_note,
            update_note,
            delete_note,
            search_notes,
            toggle_pin_note,
            get_settings,
            update_setting,
            register_shortcut,
            set_autostart,
            generate_ai_response,
            hide_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running QNotes");
}

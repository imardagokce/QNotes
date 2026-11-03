use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, WindowEvent};
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
// Tauri Commands
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

#[tauri::command]
fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// App Entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Ok(alt_space) = "alt+space".parse::<Shortcut>() {
                            if shortcut == &alt_space {
                                if let Some(window) = app.get_webview_window("main") {
                                    if window.is_visible().unwrap_or(false) {
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
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

            // Create notes table with full schema
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

            // Safe schema migrations if table existed previously
            let _ = conn.execute("ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT '';", []);
            let _ = conn.execute("ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';", []);
            let _ = conn.execute("ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;", []);

            app.manage(DbState(Mutex::new(conn)));

            // Register Alt+Space shortcut
            if let Ok(alt_space) = "alt+space".parse::<Shortcut>() {
                let _ = app.global_shortcut().register(alt_space);
            }

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
            hide_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running QNotes");
}

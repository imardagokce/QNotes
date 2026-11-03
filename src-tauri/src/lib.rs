use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Data model returned to the frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: i64,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn list_notes(db: State<'_, DbPool>) -> Result<Vec<Note>, String> {
    let pool = db.0.lock().await;
    let rows = sqlx::query_as!(
        Note,
        "SELECT id, content, created_at, updated_at FROM notes ORDER BY updated_at DESC"
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_note(content: String, db: State<'_, DbPool>) -> Result<Note, String> {
    let pool = db.0.lock().await;
    let note = sqlx::query_as!(
        Note,
        r#"
        INSERT INTO notes (content) VALUES (?)
        RETURNING id, content, created_at, updated_at
        "#,
        content
    )
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(note)
}

#[tauri::command]
async fn update_note(id: i64, content: String, db: State<'_, DbPool>) -> Result<(), String> {
    let pool = db.0.lock().await;
    sqlx::query!(
        "UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        content,
        id
    )
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_note(id: i64, db: State<'_, DbPool>) -> Result<(), String> {
    let pool = db.0.lock().await;
    sqlx::query!("DELETE FROM notes WHERE id = ?", id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// App entry point (lib)
// ---------------------------------------------------------------------------

use std::sync::Arc;
use tokio::sync::Mutex;
use sqlx::SqlitePool;

pub struct DbPool(Arc<Mutex<SqlitePool>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create notes table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS notes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                content     TEXT    NOT NULL DEFAULT '',
                created_at  TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
                updated_at  TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
            );
        "#,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:qnotes.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            list_notes,
            create_note,
            update_note,
            delete_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running QNotes");
}

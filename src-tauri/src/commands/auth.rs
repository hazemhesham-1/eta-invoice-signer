use tauri::{AppHandle, Manager, Emitter, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[tauri::command]
pub async fn get_current_user(token: String) -> serde_json::Value {
    let client = reqwest::Client::new();

    let result = async {
        let response = client.get("https://api.iwomt.net/api/user/me").bearer_auth(&token).send().await.map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("Failed to get current user: {}", response.status().as_u16()));
        }

        response.json::<serde_json::Value>().await.map_err(|e| e.to_string())
    }
    .await;

    match result {
        Ok(data) => data,
        Err(message) => serde_json::json!({ "success": false, "error": message })
    }
}

#[tauri::command]
pub async fn open_auth_window(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("auth") {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let main_window = app.get_webview_window("main").ok_or_else(|| "Main window not found".to_string())?;

    let login_url = WebviewUrl::External("https://portal.iwomt.net/auth/employee/login?display=popup".parse().unwrap());

    let mut builder = WebviewWindowBuilder::new(&app, "auth", login_url).title("User Authentication");
    builder = builder.inner_size(500.0, 340.0).resizable(false).center().parent(&main_window).map_err(|e| e.to_string())?;

    let succeeded = Arc::new(AtomicBool::new(false));

    let auth_handle = app.clone();
    let succeeded_nav = succeeded.clone();

    builder = builder.on_navigation(move |_url| {
        let handle = auth_handle.clone();
        let succeeded_nav = succeeded_nav.clone();

        tauri::async_runtime::spawn(async move {
            if let Some(auth_win) = handle.get_webview_window("auth") {
                if let Ok(cookies) = auth_win.cookies() {
                    let refresh_token = cookies.iter().find(|c| c.name() == "jwt");

                    if let Some(cookie) = refresh_token {
                        let jwt_value = cookie.value().to_string();

                        let client = reqwest::Client::new();
                        let res = client.get("https://api.iwomt.net/auth/refresh").header(reqwest::header::COOKIE, format!("jwt={jwt_value}")).send().await;

                        if let Ok(response) = res {
                            if let Ok(data) = response.json::<serde_json::Value>().await {
                                if let Some(token) = data.get("accessToken").and_then(|t| t.as_str()) {
                                    if let Some(main_win) = handle.get_webview_window("main") {
                                        let _ = main_win.emit("auth:send-token", token);
                                    }

                                    succeeded_nav.store(true, Ordering::SeqCst);
                                    let _ = auth_win.close();
                                }
                            }
                        }
                    }
                }
            }
        });

        true
    });

    let auth_window = builder.build().map_err(|e| e.to_string())?;

    let app_handle2 = app.clone();
    let succeeded_for_close = succeeded.clone();
    auth_window.on_window_event(move |event| {
        if let WindowEvent::Destroyed = event {
            if !succeeded_for_close.load(Ordering::SeqCst) {
                if let Some(main) = app_handle2.get_webview_window("main") {
                    let _ = main.emit("auth:failed", ());
                }
            }
        }
    });

    Ok(())
}
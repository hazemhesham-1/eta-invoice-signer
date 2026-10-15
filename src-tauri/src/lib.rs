#[cfg_attr(mobile, tauri::mobile_entry_point)]

use tauri::{AppHandle, Manager, Emitter, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use cryptoki::context::{CInitializeArgs, CInitializeFlags, Pkcs11};

use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::path::Path;

use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(all(target_os = "windows", debug_assertions))]
const MODULE_LIB_PATH: &str = r"D:\Program Files\SoftHSM2\lib\softhsm2-x64.dll";

#[cfg(all(target_os = "windows", not(debug_assertions)))]
const MODULE_LIB_PATH: &str = r"C:\Windows\System32\eps2003csp11.dll";

#[cfg(not(target_os = "windows"))]
const MODULE_LIB_PATH: &str = "/usr/local/lib/softhsm/libsofthsm2.so";

struct Pkcs11State(Mutex<Pkcs11>);

fn launch_sign_client() {
    const SIGN_CLIENT_APP_PATH: &str = r"C:\ProgramData\ESCC\ItidaSignClient.exe";

    let mut cmd = Command::new(SIGN_CLIENT_APP_PATH);
    cmd.arg("escc:lang=en").stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(windows)]
    cmd.creation_flags(0x0000_0008 | 0x0000_0200);

    match cmd.spawn() {
        Ok(_child) => {}
        Err(e) => eprintln!("[signer] failed to launch sign client: {e}"),
    }
}

pub fn run() {
    tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
        if cfg!(debug_assertions) {
            app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
        }

        launch_sign_client();

        eprintln!("[usb] loading PKCS#11 module from: {MODULE_LIB_PATH}");

        if !Path::new(MODULE_LIB_PATH).exists() {
            let error_msg = format!("PKCS#11 module library not found at path:\n{}", MODULE_LIB_PATH);

            app.dialog()
                .message(&error_msg)
                .title("Initialization Error")
                .kind(MessageDialogKind::Error)
                .blocking_show();

            return Err(error_msg.into());
        }

        let pkcs11 = Pkcs11::new(MODULE_LIB_PATH).map_err(|e| format!("Failed to load PKCS#11 module: {e}"))?;

        eprintln!("[usb] module loaded successfully");

        pkcs11.initialize(CInitializeArgs::new(CInitializeFlags::OS_LOCKING_OK)).map_err(|e| format!("Failed to initialize PKCS#11: {}", e))?;

        app.manage(Pkcs11State(Mutex::new(pkcs11)));

        Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        open_auth_window,
        get_draft_invoices,
        get_certificates,
        sign_invoices,
        save_invoice_signature,
        submit_invoices,
        get_usb_token
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

#[tauri::command]
async fn open_auth_window(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("auth") {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let main_window = app.get_webview_window("main").ok_or_else(|| "Main window not found".to_string())?;

    let login_url = WebviewUrl::External("https://portal.iwomt.net/auth/employee/login?display=popup".parse().unwrap());

    let mut builder = WebviewWindowBuilder::new(&app, "auth", login_url).title("User Authentication");
    builder = builder.inner_size(500.0, 340.0).resizable(false).parent(&main_window).map_err(|e| e.to_string())?;

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

#[tauri::command]
async fn get_draft_invoices(token: String) -> serde_json::Value {
    let client = reqwest::Client::new();

    let result = async {
        let response = client.get("https://api.iwomt.net/api/finance/invoices/drafts").bearer_auth(&token).send().await.map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("Failed to fetch draft invoices: {}", response.status().as_u16()));
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
async fn get_certificates() -> serde_json::Value {
    let result: Result<serde_json::Value, String> = async {
        let client = reqwest::Client::builder().danger_accept_invalid_certs(true).build().map_err(|e| e.to_string())?;

        let response = client
            .post("https://localhost:60025/")
            .header(reqwest::header::ORIGIN, "https://profile.preprod.eta.gov.eg")
            .body("cmd=store&domain=https://profile.preprod.eta.gov.eg")
            .send().await.map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("HTTP error! Status: {}", response.status().as_u16()));
        }

        let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

        match data.get("value") {
            Some(v) if !v.is_null() => Ok(v.clone()), _ => Err(data.get("error").and_then(|e| e.as_str()).unwrap_or("Unknown signer error").to_string())
        }
    }
    .await;

    match result {
        Ok(value) => serde_json::json!({ "success": true, "data": value }),
        Err(message) => serde_json::json!({ "success": false, "error": message })
    }
}

#[tauri::command]
async fn sign_invoices(data: serde_json::Value) -> serde_json::Value {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use serde_json::{json, Value};

    let result: Result<Value, String> = async {
        let documents = data
            .get("documents")
            .and_then(|d| d.as_array())
            .ok_or_else(|| { "Failed to proceed. Invoices data are missing from the request payload.".to_string() })?;

        let certificate_id = data
            .get("certificateId")
            .and_then(|c| c.as_str())
            .filter(|c| !c.is_empty())
            .ok_or_else(|| { "Failed to proceed. The digital signing certificate ID is missing.".to_string() })?;

        let client = reqwest::Client::new();
        let hash_response = client
            .put("https://api-portal.preprod.invoicing.eta.gov.eg/Api/v1/taxpayers/new/getsignabledata/")
            .json(&json!({ "documents": documents, "signatureTypeCode": "I" }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !hash_response.status().is_success() {
            return Err("Failed to retrieve the canonical layout and SHA256 hash. Please verify the invoices format.".to_string());
        }

        let parsed_hash: Value = hash_response.json().await.map_err(|e| e.to_string())?;
        let signable_docs = parsed_hash
            .get("documents")
            .and_then(|d| d.as_array())
            .ok_or_else(|| "The signable data response had no documents.".to_string())?;

        let mut hash_data: Vec<Value> = Vec::new();
        let mut crypto_elements: Vec<Value> = Vec::new();

        for doc in signable_docs {
            let signable_b64 = doc.get("signableDataBase64").and_then(|v| v.as_str()).ok_or_else(|| "A document is missing signableDataBase64.".to_string())?;
            let signable_raw = doc.get("signableData").and_then(|v| v.as_str()).unwrap_or("");

            let sha_b64 = doc.get("shA256").and_then(|v| v.as_str()).ok_or_else(|| "A document is missing shA256.".to_string())?;
            let sha_hex = hex::encode(STANDARD.decode(sha_b64).map_err(|e| e.to_string())?);

            hash_data.push(json!({
                "canonical": { "base64": signable_b64, "raw": signable_raw },
                "hash": { "base64": sha_b64, "raw": sha_hex }
            }));

            crypto_elements.push(json!({ "data": signable_b64, "hash": sha_b64 }));
        }

        let datalist = STANDARD.encode(serde_json::to_string(&crypto_elements).map_err(|e| e.to_string())?);

        let signer_client = reqwest::Client::builder().danger_accept_invalid_certs(true).build().map_err(|e| e.to_string())?;

        let sign_response = signer_client
            .post("https://localhost:60025/")
            .header(reqwest::header::ORIGIN, "https://profile.preprod.eta.gov.eg")
            .body(format!("cmd=sign&tspURL=&type=4&datalist={datalist}&thumbprint={certificate_id}&domain=https://profile.preprod.eta.gov.eg"))
            .send().await.map_err(|e| e.to_string())?;

        if !sign_response.status().is_success() {
            return Err("Data serialization was successful, but failed to apply the digital signature. Please verify that your USB token is connected and your PIN is correct.".to_string());
        }

        let parsed_sign: Value = sign_response.json().await.map_err(|e| e.to_string())?;
        let signed = match parsed_sign.get("value") {
            Some(v) if !v.is_null() => v.clone(), _ => {
                return Err(parsed_sign.get("error").and_then(|e| e.as_str()).unwrap_or("Unknown signer error").to_string())
            }
        };

        Ok(json!({
            "success": true,
            "data": signed,
            "hashResult": { "success": true, "data": hash_data }
        }))
    }
    .await;

    match result {
        Ok(value) => value,
        Err(message) => json!({ "success": false, "error": message })
    }
}

#[tauri::command]
async fn save_invoice_signature(token: String, invoice_id: String, signature_data: serde_json::Value) -> serde_json::Value {
    let client = reqwest::Client::new();

    let result = async {
        let response = client.patch(format!("https://api.iwomt.net/api/finance/invoices/{invoice_id}")).bearer_auth(&token).json(&signature_data).send().await.map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("Failed to attach signature to invoice: {}", response.status().as_u16()));
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
async fn submit_invoices(token: String, invoice_ids: Vec<String>) -> serde_json::Value {
    let client = reqwest::Client::new();

    let result = async {
        let response = client
            .post("http://api.iwomt.net/api/finance/invoices/submit")
            .bearer_auth(&token)
            .json(&serde_json::json!({ "invoiceIds": invoice_ids }))
            .send().await.map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("Failed to submit signed invoice: {}", response.status().as_u16()));
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
fn get_usb_token(state: tauri::State<Pkcs11State>) -> serde_json::Value {
    let pkcs11 = state.0.lock().unwrap();
    let result: Result<Option<(String, String)>, String> = (|| {
        let slots_with_tokens = pkcs11.get_slots_with_token().map_err(|e| format!("Failed to read device slots: {}", e))?;

        eprintln!("[usb] slots with tokens: {}", slots_with_tokens.len());

        let Some(slot) = slots_with_tokens.into_iter().next() else {
            return Ok(None);
        };

        let token_info = pkcs11.get_token_info(slot).map_err(|e| e.to_string())?;

        let slot_id_hex = format!("{:x}", slot.id());
        let label = token_info.label().trim().to_string();

        Ok(Some((slot_id_hex, label)))
    })();

    match result {
        Ok(Some((slot_id, label))) => {
            serde_json::json!({ "success": true, "slotId": slot_id, "label": label })
        }
        Ok(None) => {
            serde_json::json!({ "success": false, "slotId": null, "label": "" })
        }
        Err(message) => serde_json::json!({ "success": false, "error": message })
    }
}
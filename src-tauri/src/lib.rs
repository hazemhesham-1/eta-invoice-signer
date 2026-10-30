mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]

use tauri::Manager;
use cryptoki::context::{CInitializeArgs, CInitializeFlags, Pkcs11};

use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::path::Path;

use commands::crypto::Pkcs11State;

use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(all(target_os = "windows", debug_assertions))]
const MODULE_LIB_PATH: &str = r"D:\Program Files\SoftHSM2\lib\softhsm2-x64.dll";

#[cfg(all(target_os = "windows", not(debug_assertions)))]
const MODULE_LIB_PATH: &str = r"C:\Windows\System32\eps2003csp11.dll";

#[cfg(not(target_os = "windows"))]
const MODULE_LIB_PATH: &str = "/usr/local/lib/softhsm/libsofthsm2.so";

#[tauri::command]
fn open_soft_keyboard() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd").args(["/C", "start", "osk.exe"]).spawn().map(|_| ()).map_err(|e| e.to_string())
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("onboard").spawn().map(|_| ()).map_err(|e| e.to_string())
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("osascript").args(["-e", "tell application \"System Events\" to set visible of process \"Accessibility Keyboard\" to true"]).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
}

fn launch_sign_client() {
    const SIGN_CLIENT_APP_PATH: &str = r"C:\ProgramData\ESCC\ItidaSignClient.exe";

    let mut cmd = Command::new(SIGN_CLIENT_APP_PATH);
    cmd.arg("escc:lang=en").stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(windows)]
    cmd.creation_flags(0x0000_0008 | 0x0000_0200);

    match cmd.spawn() {
        Ok(_child) => {}
        Err(e) => eprintln!("[itida-signer] failed to launch sign client: {e}"),
    }
}

pub fn run() {
    tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
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
        commands::auth::open_auth_window,
        commands::auth::get_current_user,
        commands::certificates::list_certificates_itida,
        commands::certificates::list_certificates_native,
        commands::crypto::get_usb_token,
        commands::crypto::sign_invoices_itida,
        commands::crypto::sign_invoices_native,
        commands::invoices::get_draft_invoices,
        commands::invoices::save_invoice_signature,
        commands::invoices::submit_invoices,
        open_soft_keyboard
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn list_certificates_native(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let command = app.shell().sidecar("signer-service").map_err(|e| format!("Failed to locate Signing service: {e}"))?.args(["cert"]);
    let output = command.output().await.map_err(|e| format!("Failed to run Signing service: {e}"))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Signing service failed: {error}"));
    }

    let certificates_json = String::from_utf8(output.stdout).map_err(|e| format!("Invalid UTF-8 output: {e}"))?;

    Ok(serde_json::json!({ "success": true, "data": certificates_json }))
}

#[tauri::command]
pub async fn list_certificates_itida() -> serde_json::Value {
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
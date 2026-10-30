#[tauri::command]
pub async fn get_draft_invoices(token: String) -> serde_json::Value {
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
pub async fn save_invoice_signature(token: String, invoice_id: String, signature_data: serde_json::Value) -> serde_json::Value {
    let client = reqwest::Client::new();

    let result = async {
        let response = client.put(format!("https://api.iwomt.net/api/finance/invoices/{invoice_id}/signature")).bearer_auth(&token).json(&signature_data).send().await.map_err(|e| e.to_string())?;

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
pub async fn submit_invoices(token: String, invoice_ids: Vec<String>) -> serde_json::Value {
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
use std::sync::Mutex;
use cryptoki::context::Pkcs11;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

pub struct Pkcs11State(pub Mutex<Pkcs11>);

#[derive(Deserialize, Serialize)]
pub struct SignatureData {
    #[serde(rename = "signatureType")]
    signature_type: String,
    value: String,
}

#[derive(Deserialize)]
struct SignResponse {
    success: bool,
    signature: Option<SignatureData>,
    error: Option<String>,
}

#[tauri::command]
pub fn get_usb_token(state: tauri::State<Pkcs11State>) -> serde_json::Value {
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

#[tauri::command]
pub async fn sign_invoices_native(app: AppHandle, data: serde_json::Value) -> Result<serde_json::Value, String> {
    use serde_json::{json, Value};
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let documents = data
        .get("documents")
        .and_then(|d| d.as_array())
        .ok_or_else(|| { "Failed to proceed. Invoices data are missing from the request payload.".to_string() })?;

    let thumbprint = data
        .get("certificateId")
        .and_then(|c| c.as_str())
        .filter(|c| !c.is_empty())
        .ok_or_else(|| { "Failed to proceed. The digital signing certificate ID is missing.".to_string() })?;

    let token_pin = data
        .get("tokenPin")
        .and_then(|c| c.as_str())
        .filter(|c| !c.is_empty())
        .ok_or_else(|| { "Failed to proceed. The hardware token pin is missing.".to_string() })?;

    let serialized_bytes = serde_json::to_vec(&documents).expect("Failed to serialize documents");

    // Send the request to the bundled sidecar.
    let request = json!({
        "action": "sign",
        "thumbprint": thumbprint,
        "document": STANDARD.encode(&serialized_bytes),
        "tokenPin": token_pin
    });

    let mut child = app
        .shell()
        .sidecar("signer-service")
        .map_err(|e| format!("Cannot locate Signing service: {e}"))?
        .spawn()
        .map_err(|e| format!("Cannot start Signing service: {e}"))?;

    child
        .1
        .write(format!("{}\n", request).as_bytes())
        .map_err(|e| format!("Cannot send signing request: {e}"))?;

    let (mut receiver, _child) = child;

    let mut stdout = Vec::new();
    let mut stderr = Vec::new();

    while let Some(event) = receiver.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => stdout.extend(bytes),
            CommandEvent::Stderr(bytes) => stderr.extend(bytes),
            CommandEvent::Terminated(payload) => {
                if payload.code != Some(0) {
                    return Err(format!("Native Signing service failed: {}", String::from_utf8_lossy(&stderr)));
                }

                break;
            }
            _ => {}
        }
    }

    let response: SignResponse = serde_json::from_slice(&stdout).map_err(|e| format!("Invalid response from signing service: {e}. Output: {}", String::from_utf8_lossy(&stdout)))?;

    if !response.success {
        return Ok(json!({
            "success": false,
            "data": Value::Null,
            "error": response.error.unwrap_or_else(|| "Native Signing service failed".into())
        }));
    }

    Ok(json!({
        "success": true,
        "data": serde_json::to_value(&response.signature).unwrap_or(Value::Null),
        "error": Value::Null
    }))
}

#[tauri::command]
pub async fn sign_invoices_itida(data: serde_json::Value) -> serde_json::Value {
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
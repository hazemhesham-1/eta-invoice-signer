import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    listInvoices: (token) => ipcRenderer.invoke("invoices:get-list", token),
    saveSignature: (token, invoiceId, signatureData) => ipcRenderer.invoke("invoices:save-signature", token, { invoiceId, signatureData }),
    submitInvoices: (token, invoiceIds) => ipcRenderer.invoke("invoices:submit", token, { invoiceIds }),
    listCertificates: () => ipcRenderer.invoke("signer:list-certificates"),
    signInvoices: (data) => ipcRenderer.invoke("signer:sign-invoices", data),
    checkTokenStatus: () => ipcRenderer.invoke("usb:check-hardware-token"),
    openLoginModal: () => ipcRenderer.send("auth:open-window"),
    onAuthSuccess: (callback) => {
        const subscription = (_event, token) => callback(token);
        ipcRenderer.on("auth:send-token", subscription);
        
        return () => ipcRenderer.removeListener("auth:send-token", subscription);
    },
    onAuthFailed: (callback) => {
        ipcRenderer.on("auth:failed", callback);
        return () => ipcRenderer.removeListener("auth:failed", callback);
    },
    onUpdateAvailable(callback) {
        ipcRenderer.on("update-available", (_, data) => callback(data));
    },
    onUpdateProgress(callback) {
        ipcRenderer.on("update-progress", (_, data) => callback(data));
    },
    onUpdateDownloaded(callback) {
        ipcRenderer.on("update-downloaded", (_, data) => callback(data));
    },
    onUpdateError(callback) {
        ipcRenderer.on("update-error", (_, data) => callback(data));
    },
    installUpdate() { ipcRenderer.send("install-update"); }
});
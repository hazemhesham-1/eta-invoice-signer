import { app, BrowserWindow, ipcMain, net, session } from "electron";
import electronUpdater from "electron-updater";
import pkcs11js from "pkcs11js";
import { spawn } from "node:child_process";
import path from "node:path";
import started from "electron-squirrel-startup";

let mainWindow, authWindow;
const { autoUpdater } = electronUpdater;

const pkcs11 = new pkcs11js.PKCS11();
const LIB_PATH = process.platform === "win32" ? "C:\\Windows\\System32\\eps2003csp11.dll" : "/usr/local/lib/softhsm/libsofthsm2.so";

function initPkcs11() {
    try {
        pkcs11.load(LIB_PATH);
        pkcs11.C_Initialize();
    }
    catch(error) {
        console.error("Failed to load PKCS11 library: ", error);
    }
}

if(started) {
    app.quit();
}

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 800,
        minHeight: 500,
        minWidth: 800,
        icon: path.join(__dirname, "../../assets/icon.ico"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if(MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    }
    else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
};

ipcMain.on("auth:open-window", () => {
    if(authWindow) {
        authWindow.focus();
        return;
    }

    session.defaultSession.clearStorageData({ storages: ["cookies"] });

    authWindow = new BrowserWindow({
        width: 500,
        height: 340,
        parent: mainWindow,
        modal: true,
        show: false,
        resizable: false,
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: "#D3D3D3",
            symbolColor: "#5F6368",
            height: 20
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    authWindow.loadURL("https://portal.iwomt.net/auth/employee/login");
    authWindow.once("ready-to-show", () => { authWindow.show() });

    authWindow.webContents.on("dom-ready", () => {
        authWindow.webContents.executeJavaScript("window.scrollTo(0, document.body.scrollHeight);");
        authWindow.webContents.insertCSS(`
            body, html {
                overflow: hidden !important;
            }
            ::-webkit-scrollbar {
                display: none !important;
            }
        `);
    });

    authWindow.webContents.on("did-navigate-in-page", async () => {
        const webSession = authWindow.webContents.session;
        const refreshToken = await webSession.cookies.get({}).then((cookies) => cookies.find((cookie) => cookie.name === "jwt")?.value);

        if(refreshToken) {
            const response = await net.fetch("https://api.iwomt.net/auth/refresh");
            const data = await response.json();

            const { accessToken } = data;
            if(accessToken) {
                mainWindow.webContents.send("auth:send-token", accessToken);
                authWindow.close();
            }
        }
    });

    authWindow.on("closed", async () => {
        const token = await session.defaultSession.cookies.get({}).then((cookies) => cookies.find((cookie) => cookie.name === "jwt")?.value);
        if(!token) {
            mainWindow.webContents.send("auth:failed");
        }
        
        authWindow = null;
    });
});

app.whenReady().then(() => {
    createWindow();

    // const SIGN_CLIENT_APP_PATH = "C:\\ProgramData\\ESCC\\ItidaSignClient.exe";
    // const child = spawn(SIGN_CLIENT_APP_PATH, ["escc:lang=en"], {
    //     detached: true,
    //     stdio: "ignore"
    // });

    // child.unref();
    initPkcs11();

    // On OS X it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
    app.on("activate", () => {
        if(BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    if(app.isPackaged) {
        checkForUpdates();
    }
});

app.on("window-all-closed", () => {
    session.defaultSession.clearStorageData({ storages: ["cookies"] });
    if(process.platform !== "darwin") {
        app.quit();
    }
});

ipcMain.handle("signer:sign-invoices", async (_event, data) => {
    if(!data.documents || !Array.isArray(data.documents)) {
        return { success: false, error: "Failed to proceed. Invoices data are missing from the request payload." };
    }
    if(!data.certificateId) {
        return { success: false, error: "Failed to proceed. The digital signing certificate ID is missing." };
    }

    try {
        const payload = {
            documents: data.documents,
            signatureTypeCode: "I"
        };
        
        const hashResponse = await net.fetch("https://api-portal.preprod.invoicing.eta.gov.eg/Api/v1/taxpayers/new/getsignabledata/", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if(!hashResponse.ok) {
            throw new Error(`Failed to retrieve the canonical layout and SHA256 hash. Please verify the invoices format.`);
        }

        const parsedHashData = await hashResponse.json();

        const hashResult = {
            success: true,
            data: parsedHashData.documents.map((document) => ({
                canonical: {
                    base64: document.signableDataBase64,
                    raw: document.signableData
                },
                hash: {
                    base64: document.shA256,
                    raw: Buffer.from(document.shA256, "base64").toString("hex")
                }
            }))
        };

        const encodedCryptoElements = hashResult.data.map((document) => ({ data: document.canonical.base64, hash: document.hash.base64 }));
        const base64EncodedCryptoArray = Buffer.from(JSON.stringify(encodedCryptoElements), "utf8").toString("base64");

        const signResponse = await net.fetch("https://localhost:60025/", {
            method: "POST",
            headers: {
                origin: "https://profile.preprod.eta.gov.eg"
            },
            body: `cmd=sign&tspURL=&type=4&datalist=${base64EncodedCryptoArray}&thumbprint=${data.certificateId}&domain=https://profile.preprod.eta.gov.eg`
        });

        if(!signResponse.ok) {
            throw new Error("Data serialization was successful, but failed to apply the digital signature. Please verify that your USB token is connected and your PIN is correct.");
        }

        const parsedSignData = await signResponse.json();
        if(!parsedSignData?.value) {
            throw new Error(parsedSignData?.error);
        }

        return { success: true, data: parsedSignData?.value, hashResult };
    }
    catch(err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle("signer:list-certificates", async () => {
    try {
        const response = await net.fetch("https://localhost:60025/", {
            method: "POST",
            headers: {
                origin: "https://profile.preprod.eta.gov.eg"
            },
            body: "cmd=store&domain=https://profile.preprod.eta.gov.eg"
        });

        if(!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        if(!data?.value) {
            throw new Error(data?.error);
        }

        return { success: true, data: data?.value };
    }
    catch(err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle("invoices:get-list", async (_event, token) => {
    try {
        const options = {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };

        const response = await net.fetch("http://api.iwomt.net/api/finance/invoices/drafts", options);
        if(!response.ok) {
            throw new Error(`Failed to fetch draft invoices: ${response.status}`);
        }

        const result = await response.json();
        return result;
    }
    catch(err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle("invoices:save-signature", async (_event, token, { invoiceId, signatureData }) => {
    try {
        const options = {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(signatureData)
        };

        const response = await net.fetch(`http://api.iwomt.net/api/finance/invoices/${invoiceId}`, options);
        if(!response.ok) {
            throw new Error(`Failed to attach signature to invoice: ${response.status}`);
        }

        const result = await response.json();
        return result;
    }
    catch(err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle("invoices:submit", async (_event, token, { invoiceIds }) => {
    try {
        const options = {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ invoiceIds })
        };

        const response = await net.fetch("http://api.iwomt.net/api/finance/invoices/submit", options);
        if(!response.ok) {
            throw new Error(`Failed to submit signed invoice: ${response.status}`);
        }

        const result = await response.json();
        return result;
    }
    catch(err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle("usb:check-hardware-token", async () => {
    try {
        const slotsWithTokens = pkcs11.C_GetSlotList(true);
        console.log("Number of slots with tokens: ", slotsWithTokens.length);

        if(slotsWithTokens.length > 0) {
            const slotId = slotsWithTokens[0];
            const tokenInfo = pkcs11.C_GetTokenInfo(slotId);

            return {
                success: true,
                slotId: slotId.toString("hex"),
                label: tokenInfo.label.trim()
            };
        }

        return { success: false, slotId: null, label: "" };
    }
    catch(err) {
        return { success: false, error: err.message };
    }
});

function checkForUpdates() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.checkForUpdates();

    autoUpdater.on("checking-for-update", () => {
        console.log("Checking for updates...");
    });

    autoUpdater.on("update-available", (info) => {
        console.log("Update available: ", info.version);
        mainWindow.webContents.send("update-available", { version: info.version });
    });

    autoUpdater.on("download-progress", (progress) => {
        mainWindow.webContents.send("update-progress", { percent: progress.percent });
    });

    autoUpdater.on("update-downloaded", (info) => {
        console.log("Update downloaded: ", info.version);
        mainWindow.webContents.send("update-downloaded", { version: info.version });
    });

    autoUpdater.on("error", (error) => {
        console.error("Update error: ", error);
        mainWindow.webContents.send("update-error", { message: error.message });
    });
}

ipcMain.on("install-update", () => {
    autoUpdater.quitAndInstall();
});
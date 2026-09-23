import path from "path";
import fs from "fs-extra";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

export default {
    packagerConfig: {
        asar: true,
        icon: "./assets/icon.ico"
    },
    rebuildConfig: {},
    hooks: {
        packageAfterCopy: async (_config, buildPath, _electronVersion, _platform, _arch) => {
            const srcNodeModules = path.resolve(import.meta.dirname, "node_modules/pkcs11js");
            const destNodeModules = path.resolve(buildPath, "node_modules/pkcs11js");
            if(await fs.pathExists(srcNodeModules)) {
                await fs.copy(srcNodeModules, destNodeModules);
            }
        }
    },
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {
                name: "IWOMT_ETA_Invoice_Signer",
                description: "ETA Invoice Signing App for IWOMT by Eng. Hazem Hesham",
                authors: "Hazem Hesham",
                setupIcon: "./assets/icon.ico"
            },
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["win32", "darwin"],
        },
        {
            name: "@electron-forge/maker-deb",
            config: {
                options: {
                    icon: "./assets/icon.ico"
                }
            },
        },
    ],
    plugins: [
        {
            name: "@electron-forge/plugin-auto-unpack-natives",
            config: {}
        },
        {
            name: "@electron-forge/plugin-vite",
            config: {
                // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
                // If you are familiar with Vite configuration, it will look really familiar.
                build: [
                    {
                        // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
                        entry: "electron/main.js",
                        config: "vite.main.config.mjs",
                        target: "main",
                    },
                    {
                        entry: "electron/preload.js",
                        config: "vite.preload.config.mjs",
                        target: "preload",
                    },
                ],
                renderer: [
                    {
                        name: "main_window",
                        config: "vite.renderer.config.mjs",
                    },
                ],
            },
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
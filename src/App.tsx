import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import AuthProvider, { useAuth } from "@/contexts/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import FullPageSpinner from "./components/FullPageSpinner";
import AccessDeniedBanner from "./components/AccessDeniedBanner";
import LoginView from "@/components/LoginView";
import DashboardView from "./components/DashboardView";
import HardwareTokenPinInput from "./components/HardwareTokenPinInput";

const AppContent = () => {
    const { token, user, isLoading } = useAuth();
    const isAuthorized = user?.isAuthorized;

    return (
        <main className="bg-background min-h-screen min-w-3xl flex flex-col gap-5">
            <Header/>
            <main className="grow px-6 text-center">
                {!token ? <LoginView/> : isLoading ? <FullPageSpinner/> : isAuthorized ? <DashboardView/> : <AccessDeniedBanner/>}
            </main>
            <Footer/>
        </main>
    );
};

const App = () => {
    const [route, setRoute] = useState(window.location.hash);

    useEffect(() => {
        const handleHashChange = () => setRoute(window.location.hash);

        window.addEventListener("hashchange", handleHashChange);
        return () => window.removeEventListener("hashchange", handleHashChange);
    }, []);

    useEffect(() => {
        let isClosing = false;
        let cancelled = false;

        async function setup() {
            const window = getCurrentWindow();

            const unlisten = await window.onCloseRequested(async (event) => {
                event.preventDefault();

                if(isClosing) return;
                isClosing = true;

                try {
                    await getCurrentWebview().clearAllBrowsingData();

                    if(cancelled) return;

                    await window.destroy();
                }
                catch(error) {
                    console.error("Failed to clear browsing data: ", error);
                    isClosing = false;
                }
            });

            if(cancelled) {
                unlisten();
            }
        };

        setup();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <AuthProvider>
            {route.includes("#/auth/usb-token") ? <HardwareTokenPinInput/> : <AppContent/>}
        </AuthProvider>
    );
};

export default App;
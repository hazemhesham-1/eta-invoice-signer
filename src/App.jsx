import AuthProvider, { useAuth } from "@/contexts/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import FullPageSpinner from "./components/FullPageSpinner";
import AccessDeniedBanner from "./components/AccessDeniedBanner";
import LoginView from "@/components/LoginView";
import DashboardView from "./components/DashboardView";

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
    return (
        <AuthProvider>
            <AppContent/>
        </AuthProvider>
    );
};

export default App;
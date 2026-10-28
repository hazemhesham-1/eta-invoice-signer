import { createContext, useContext, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { UserResponse, UserSession } from "@/lib/types";

interface AuthContextType {
    token: string | null;
    user: UserSession | null;
    isLoading: boolean;
    login: () => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<UserSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function initializeUserSession(event: { payload: string }) {
            const receivedToken = event.payload;

            try {
                setToken(receivedToken);

                const userData: UserResponse = await invoke("get_current_user", { token: receivedToken });
                if(userData?.department.type === "FINANCE_DEPARTMENT") {
                    setUser({
                        name: `${userData.name.first.en} ${userData.name.last.en}`,
                        jobTitle: userData.jobTitle,
                        email: userData.email,
                        isAuthorized: true
                    });
                }
            }
            catch (error) {
                console.error("Failed to fetch user data:", error);
            }
            finally {
                setIsLoading(false);
            }
        }

        const unlistenPromise = listen("auth:send-token", initializeUserSession);

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    }, []);

    useEffect(() => {
        function clearUserSession() {
            setToken(null);
            setUser(null);
            setIsLoading(false);
        }

        const unlistenPromise = listen("auth:failed", clearUserSession);

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    }, []);

    function login() {
        setIsLoading(true);
        invoke("open_auth_window");
    }

    function logout() {
        setToken(null);
        setUser(null);
        setIsLoading(false);
    }

    return (
        <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

function useAuth() {
    const context = useContext(AuthContext);
    if(context === undefined) {
        throw new Error("AuthContext was used outside of AuthProvider");
    }

    return context;
}

export { useAuth };

export default AuthProvider;
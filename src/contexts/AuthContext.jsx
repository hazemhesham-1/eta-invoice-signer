import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

function AuthProvider({ children }) {
    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function initializeUserSession(receivedToken) {
            try {
                setToken(receivedToken);
                
                const response = await fetch("https://api.iwomt.net/api/user/me", {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${receivedToken}`
                    },
                });

                const userData = await response.json();
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

        const unsubscribe = window.electronAPI.onAuthSuccess(initializeUserSession);

        return () => {
            if(unsubscribe) unsubscribe();
        };
    }, []);

    useEffect(() => {
        function clearUserSession() {
            setToken(null);
            setUser(null);
            setIsLoading(false);
        }

        const unsubscribe = window.electronAPI.onAuthFailed(clearUserSession);

        return () => {
            if(unsubscribe) unsubscribe();
        };
    }, []);

    function login() {
        setIsLoading(true);
        window.electronAPI.openLoginModal();
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
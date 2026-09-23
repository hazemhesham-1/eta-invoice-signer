import { LogInIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";

const LoginView = () => {
    const { login, isLoading } = useAuth();

    return (
        <div className="bg-slate-200 border border-border rounded-2xl w-full max-w-md mx-auto my-10 space-y-4 px-4 py-8 text-center shadow-xl">
            <Button
                size="lg"
                className="h-12 px-4 text-sm"
                onClick={login}
                disabled={isLoading}
            >
                <div className="flex items-center gap-2">
                    {isLoading ? (
                        <>
                            <Spinner/>
                            <span>Opening Secure Portal...</span>
                        </>
                    ) : (
                        <>
                            Sign In via IWOMT Secure Portal
                            <LogInIcon/>
                        </>
                    )}
                </div>
            </Button>
            <p className="text-destructive text-xs font-semibold">
                Attention: Authorized Finance Personnel Only.
            </p>
        </div>
    );
};

export default LoginView;
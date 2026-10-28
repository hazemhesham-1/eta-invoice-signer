import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/Button";

const LogOutButton = () => {
    const { logout } = useAuth();
    
    return (
        <Button
            variant="destructive"
            className="px-5 text-xs"
            onClick={logout}
        >
            تسجيل الخروج
        </Button>
    );
};

export default LogOutButton;
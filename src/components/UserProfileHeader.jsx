import { useAuth } from "@/contexts/AuthContext";
import LogOutButton from "./LogOutButton";

const UserProfileHeader = ({ tokenConnected }) => {
    const { user } = useAuth();
    
    return (
        <header className="border-b border-border flex items-start justify-end pb-5">
            <div class="space-y-1 text-end text-sm">
                <p class="text-gray-900 font-semibold">
                    {user?.name} <span class="text-gray-400 font-normal">({user?.jobTitle})</span>
                </p>
                <LogOutButton/>
            </div>
        </header>
    );
};

export default UserProfileHeader;
import { useCallback } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { FileSignatureIcon } from "lucide-react";
import { Button } from "./ui/Button";

interface SignInvoiceButtonProps extends React.ComponentProps<typeof Button> {
    isSigning: boolean;
    totalSelected: number;
    showPromptWindow?: boolean;
    onSignClick?: () => void;
};

const SignInvoiceButton = ({ isSigning, totalSelected, showPromptWindow, onSignClick, ...props }: SignInvoiceButtonProps) => {
    const openTokenPromptWindow = useCallback(async () => {
        const existingWindow = await WebviewWindow.getByLabel("usb-token-auth");

        if(existingWindow) {
            await existingWindow.setFocus();
        }
        else {
            const tokenPromptWindow = new WebviewWindow("usb-token-auth", {
                url: "#/auth/usb-token",
                title: "Verify User PIN",
                width: 420,
                height: 230,
                resizable: false,
                alwaysOnTop: true,
                center: true,
                focus: true,
                decorations: false
            });

            tokenPromptWindow.once("tauri://created", () => {
                console.log("USB Token PIN window spawned successfully.");
            });

            tokenPromptWindow.once("tauri://error", (e) => {
                console.error("Error creating USB Token PIN window:", e);
            });
        }
    }, []);

    async function handleClick() {
        if(showPromptWindow) {
            await openTokenPromptWindow();
            return;
        }

        onSignClick?.();
    }

    return (
        <Button
            size="lg"
            onClick={handleClick}
            {...props}
        >
            <FileSignatureIcon className="size-4 me-2"/>
            {isSigning ? "جاري التوقيع..." : `توقيع ${(totalSelected !== 1) ? `${totalSelected} فواتير` : "فاتورة واحدة"}`}
        </Button>
    );
};

export default SignInvoiceButton;
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "./ui/Alert";

const TokenHardwareAlert = () => {
    return (
        <Alert variant="destructive">
            <CircleAlertIcon className="size-4"/>
            <AlertDescription>
                يرجى توصيل فلاشة التوقيع الإلكتروني (USB Token) قبل البدء في توقيع الفواتير.
            </AlertDescription>
        </Alert>
    );
};

export default TokenHardwareAlert;
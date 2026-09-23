import { useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { Progress } from "./ui/Progress";

const UpdateNotification = () => {
    const [update, setUpdate] = useState(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        window.electronAPI?.onUpdateAvailable((data) => {
            setUpdate({ status: "downloading", version: data.version });
        });

        window.electronAPI?.onUpdateProgress((data) => {
            setProgress(data.percent);
        });

        window.electronAPI?.onUpdateDownloaded((data) => {
            setUpdate({ status: "ready", version: data.version });
        });

        window.electronAPI?.onUpdateError((data) => {
            console.error("Update error: ", data.message);
        });
    }, []);

    if(!update) return null;

    return (
        <div className="bg-background border rounded-lg fixed bottom-4 right-4 w-80 p-4 shadow-lg z-50">
            {update.status === "ready" ? (
                <>
                    <p className="font-medium">
                        يوجد تحديث جديد
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        الإصدار {update.version} جاهز للتثبيت.
                    </p>
                    <Button onClick={() => window.electronAPI.installUpdate()}>
                        إعادة تشغيل وتحديث
                    </Button>
                </>
            ) : update.status === "downloading" ? (
                <>
                    <p className="font-medium">
                        جاري تحديث التطبيق
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        الإصدار {update.version}
                    </p>
                    <Progress value={progress}/>
                    <p className="text-muted-foreground mt-2 text-xs">
                        {Math.round(progress)}%
                    </p>
                </>
            ) : null}
        </div>
    );
};

export default UpdateNotification;
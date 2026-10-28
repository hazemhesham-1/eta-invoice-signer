import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { XIcon } from "lucide-react";
import { Button } from "./ui/Button";
import { Progress } from "./ui/Progress";

interface UpdateInfoType {
    status: "idle" | "available" | "ready" | "checking";
    downloaded?: number;
    total?: number | null;
    version?: string;
    notes?: string;
};

interface UpdateInfoErrorType {
    status: "error";
    message: string;
};

const UpdateNotification = () => {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfoType | UpdateInfoErrorType>({ status: "idle" });

    useEffect(() => {
        async function handleUpdaterStatus() {
            setUpdateInfo({ status: "checking" });

            try {
                const update = await check();
                if(!update) {
                    setUpdateInfo({ status: "idle" });
                    return;
                }

                setUpdateInfo({ status: "available", downloaded: 0, total: null, version: update.version, notes: update.body });

                await update.downloadAndInstall((event) => {
                    if(event.event === "Started") {
                        setUpdateInfo((prev) => ({ ...prev, total: event.data.contentLength ?? null }));
                    }
                    if(event.event === "Progress") {
                        setUpdateInfo((prev) => ({ ...prev, downloaded: (prev.status !== "error") ? Number(prev.downloaded) + event.data.chunkLength : undefined }));
                    }
                    if(event.event === "Finished") {
                        setUpdateInfo((prev) => ({ ...prev, status: "ready" }));
                    }
                });
            }
            catch(err: unknown) {
                if(err instanceof Error) {
                    setUpdateInfo({ status: "error", message: err.message ?? err });
                }
            }
        }

        handleUpdaterStatus();
    }, []);

    const progress = updateInfo.status !== "error" && !isNaN(updateInfo.total as any) ?
        Math.min(100, (Number(updateInfo.downloaded) / Number(updateInfo.total)) * 100) : 0;

    const showUpdater = ["ready", "available", "checking", "error"].includes(updateInfo.status);
    if(!showUpdater) return null;

    return (
        <div
            className="bg-background border rounded-lg fixed bottom-10 left-4 w-80 p-4 text-sm text-start ring ring-primary/20 shadow-lg z-50"
            dir="rtl"
        >
            {updateInfo.status === "ready" ? (
                <>
                    <p className="font-medium">
                        يوجد تحديث جديد
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        الإصدار {updateInfo.version} جاهز للتثبيت.
                    </p>
                    <Button onClick={() => relaunch()}>
                        إعادة تشغيل وتحديث
                    </Button>
                </>
            ) : updateInfo.status === "available" ? (
                <>
                    <p className="font-medium">
                        جاري تحديث التطبيق
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        الإصدار {updateInfo.version}
                    </p>
                    <Progress value={progress}/>
                    <p className="text-muted-foreground mt-2 text-xs">
                        {progress}%
                    </p>
                </>
            ) : updateInfo.status === "checking" ? (
                <p className="font-medium">
                    جاري التحقق من وجود تحديثات...
                </p>
            ) : updateInfo.status === "error" ? (
                <div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 absolute top-0 left-0"
                        onClick={() => setUpdateInfo({ status: "idle" })}
                    >
                        <XIcon/>
                    </Button>
                    <p className="font-medium">
                        {updateInfo.message}
                    </p>
                </div>
            ) : null}
        </div>
    );
};

export default UpdateNotification;
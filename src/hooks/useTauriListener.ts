import { useEffect, useRef } from "react";
import { Event, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

function useTauriListener<T>(eventName: string, callback: (event: Event<T>) => void) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        let unlisten: UnlistenFn | null = null;

        async function setupListener() {
            const currentWindow = getCurrentWindow();

            unlisten = await currentWindow.listen<T>(eventName, (event) => {
                callbackRef.current(event);
            });
        }

        setupListener();

        return () => {
            if(unlisten) {
                unlisten();
            }
        };
    }, [eventName]);
}

export { useTauriListener };
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@/lib/utils";

function Progress({ className, children, value, ...props }) {
    return (
        <ProgressPrimitive.Root
            data-slot="progress"
            value={value}
            className={cn("flex flex-wrap gap-3", className)}
            {...props}
        >
            {children}
            <ProgressTrack>
                <ProgressIndicator/>
            </ProgressTrack>
        </ProgressPrimitive.Root>
    );
}

function ProgressTrack({ className, ...props }) {
    return (
        <ProgressPrimitive.Track
            data-slot="progress-track"
            className={cn("bg-muted rounded-full relative flex items-center h-1 w-full overflow-x-hidden", className)}
            {...props}
        />
    );
}

function ProgressIndicator({ className, ...props }) {
    return (
        <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className={cn("bg-primary h-full transition-all", className)}
            {...props}
        />
    );
}

function ProgressLabel({ className, ...props }) {
    return (
        <ProgressPrimitive.Label
            data-slot="progress-label"
            className={cn("text-sm font-medium", className)}
            {...props}
        />
    );
}

function ProgressValue({ className, ...props }) {
    return (
        <ProgressPrimitive.Value
            data-slot="progress-value"
            className={cn("text-muted-foreground ms-auto text-sm tabular-nums", className)}
            {...props}
        />
    );
}

export {
    Progress,
    ProgressTrack,
    ProgressIndicator,
    ProgressLabel,
    ProgressValue
};
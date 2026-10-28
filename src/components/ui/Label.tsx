import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
    const baseClass = "flex items-center gap-2 text-sm font-medium leading-none select-none group-data-[disabled=true]:opacity-50 group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

    return (
        <label
            data-slot="label"
            className={cn(baseClass, className)}
            {...props}
        />
    );
}

export { Label };
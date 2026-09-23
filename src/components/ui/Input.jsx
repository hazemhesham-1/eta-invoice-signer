import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }) {
    return (
        <InputPrimitive
            type={type}
            data-slot="input"
            className={cn("bg-background border border-input rounded-lg h-8 w-full min-w-0 px-2.5 py-1 text-sm outline-none transition-colors file:bg-transparent file:text-foreground file:border-0 file:inline-flex file:h-6 file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-input/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40", className)}
            {...props}
        />
    );
}

export { Input };
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "border border-transparent rounded-4xl inline-flex items-center justify-center gap-1 shrink-0 h-5 w-fit px-2 py-0.5 text-xs font-medium whitespace-nowrap overflow-hidden group/badge transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-start]:ps-1.5 has-data-[icon=inline-end]:pe-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:size-3! [&>svg]:pointer-events-none",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
                secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
                destructive: "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 [a]:hover:bg-destructive/20",
                outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
                ghost: "hover:bg-muted hover:text-muted-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
        },
        defaultVariants: {
            variant: "default",
        }
    }
);

function Badge({ className, variant = "default", render, ...props }) {
    return useRender({
        defaultTagName: "span",
        props: mergeProps({ className: cn(badgeVariants({ variant }), className) }, props),
        render,
        state: {
            slot: "badge",
            variant
        }
    });
}

export { Badge, badgeVariants };
import { useMemo } from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/Label";
import { Separator } from "@/components/ui/Separator";

function FieldSet({ className, ...props }) {
    return (
        <fieldset
            data-slot="field-set"
            className={cn("flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3", className)}
            {...props}
        />
    );
}

function FieldLegend({ className, variant = "legend", ...props }) {
    return (
        <legend
            data-slot="field-legend"
            data-variant={variant}
            className={cn("mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base", className)}
            {...props}
        />
    );
}

function FieldGroup({ className, ...props }) {
    const baseClass = "flex flex-col gap-5 w-full group/field-group @container/field-group data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4";

    return (
        <div
            data-slot="field-group"
            className={cn(baseClass, className)}
            {...props}
        />
    );
}

const fieldVariants = cva(
    "flex gap-2 w-full group/field data-[invalid=true]:text-destructive",
    {
        variants: {
            orientation: {
                vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
                horizontal: "flex-row items-center *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
                responsive: "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:*:data-[slot=field-label]:flex-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px [&>.sr-only]:w-auto"
            },
        },
        defaultVariants: {
            orientation: "vertical"
        },
    }
);

function Field({ className, orientation = "vertical", ...props }) {
    return (
        <div
            role="group"
            data-slot="field"
            data-orientation={orientation}
            className={cn(fieldVariants({ orientation }), className)}
            {...props}
        />
    );
}

function FieldContent({ className, ...props }) {
    return (
        <div
            data-slot="field-content"
            className={cn("flex flex-1 flex-col gap-0.5 leading-snug group/field-content", className)}
            {...props}
        />
    );
}

function FieldLabel({ className, ...props }) {
    return (
        <Label
            data-slot="field-label"
            className={cn(
                "flex gap-2 w-fit leading-snug group/field-label peer/field-label group-data-[disabled=true]/field:opacity-50 has-data-checked:bg-primary/5 has-data-checked:border-primary/30 has-[>[data-slot=field]]:border has-[>[data-slot=field]]:rounded-lg *:data-[slot=field]:p-2.5 dark:has-data-checked:bg-primary/10 dark:has-data-checked:border-primary/20",
                "has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:w-full",
                className
            )}
            {...props}
        />
    );
}

function FieldTitle({ className, ...props }) {
    return (
        <div
            data-slot="field-label"
            className={cn("flex items-center gap-2 w-fit text-sm font-medium group-data-[disabled=true]/field:opacity-50", className)}
            {...props}
        />
    );
}

function FieldDescription({ className, ...props }) {
    return (
        <p
            data-slot="field-description"
            className={cn(
                "text-muted-foreground text-start text-sm font-normal leading-normal group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
                "last:mt-0 nth-last-2:-mt-1",
                "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
                className
            )}
            {...props}
        />
    );
}

function FieldSeparator({ children, className, ...props }) {
    return (
        <div
            data-slot="field-separator"
            data-content={!!children}
            className={cn("relative h-5 -my-2 text-sm group-data-[variant=outline]/field-group:-mb-2", className)}
            {...props}
        >
            <Separator className="absolute inset-0 top-1/2"/>
            {children && (
                <span
                    className="bg-background text-muted-foreground relative block w-fit mx-auto px-2"
                    data-slot="field-separator-content"
                >
                    {children}
                </span>
            )}
        </div>
    );
}

function FieldError({ className, children, errors, ...props }) {
    const content = useMemo(() => {
        if(children) {
            return children;
        }

        if(!errors?.length) {
            return null;
        }

        const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];

        if(uniqueErrors?.length == 1) {
            return uniqueErrors[0]?.message;
        }

        return (
            <ul className="list-disc flex flex-col gap-1 ms-4">
                {uniqueErrors.map((error, index) => error?.message && (
                    <li key={index}>{error.message}</li>
                ))}
            </ul>
        );
    }, [children, errors]);

    if(!content) {
        return null;
    }

    return (
        <div
            role="alert"
            data-slot="field-error"
            className={cn("text-destructive text-sm font-normal", className)}
            {...props}
        >
            {content}
        </div>
    );
}

export {
    Field,
    FieldLabel,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLegend,
    FieldSeparator,
    FieldSet,
    FieldContent,
    FieldTitle
};
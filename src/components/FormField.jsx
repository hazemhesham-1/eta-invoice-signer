import { Controller, useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel } from "./ui/Field";
import { Input } from "./ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/Select";
import { Textarea } from "./ui/Textarea";

const FormField = (props) => {
    const {
        type = "text",
        name,
        label,
        description,
        options = [],
        placeholder,
        labelClassName,
        ...fieldProps
    } = props;

    const { control } = useFormContext();

    function renderElement(field, state) {
        if(type === "select") {
            return (
                <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    items={options}
                    {...fieldProps}
                >
                    <SelectTrigger
                        aria-invalid={state.invalid}
                        className={cn("border-border", fieldProps?.className)}
                    >
                        <SelectValue placeholder={placeholder}/>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                        {options.map(({ label, value }) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }
        else if(type === "textarea") {
            return (
                <Textarea
                    {...fieldProps}
                    {...field}
                    id={field.name}
                    placeholder={placeholder}
                    aria-invalid={state.invalid}
                />
            );
        }

        return (
            <Input
                {...fieldProps}
                {...field}
                type={type}
                id={field.name}
                placeholder={placeholder}
                aria-invalid={state.invalid}
            />
        );
    }

    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                    {label && (
                        <FieldLabel
                            htmlFor={field.name}
                            className={labelClassName}
                        >
                            {label}
                        </FieldLabel>
                    )}
                    {renderElement(field, fieldState)}
                    {description && (
                        <FieldDescription className="col-span-full">
                            {description}
                        </FieldDescription>
                    )}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]}/>}
                </Field>
            )}
        />
    );
};

export default FormField;
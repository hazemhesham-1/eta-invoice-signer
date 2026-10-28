import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function truncateName(name: string, parts: number = 3): string {
    const nameSegments = name.split(" ");
    return nameSegments.length > parts ? nameSegments.slice(0, parts).join(" ") : name;
}

export function utf8ToBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    
    return btoa(binString);
}

export function base64ToUtf8(base64Text: string): string {
    const binaryString = atob(base64Text);
    const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
}

export function escapeSpecialChars(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function serializeInvoice(data: Record<string, any>): string {
    if((typeof data !== "object") || (data === null)) {
        const valueStr = data !== undefined ? String(data) : "";
        return `"${escapeSpecialChars(valueStr)}"`;
    }

    let result = "";
    const processedKeys = Object.keys(data);

    for(const key of processedKeys) {
        const val = data[key];

        if(val === null || val === undefined) continue;

        result += `"${key.toUpperCase()}"`;

        if(Array.isArray(val)) {
            val.forEach((item) => {
                result += `"${key.toUpperCase()}"`;
                result += (typeof item === "object") && (item !== null) ? serializeInvoice(item) : `"${escapeSpecialChars(item.toString())}"`;
            });
        }
        else {
            result += serializeInvoice(val);
        }
    }

    return result;
}

export function serializeRawJSONString(data: string): string {
    const parsedData = JSON.parse(data);
    return serializeInvoice(parsedData);
}

export function isBase64(text: string) {
    if(typeof text !== "string" || text.trim() === "") {
        return false;
    }

    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    return base64Regex.test(text);
}
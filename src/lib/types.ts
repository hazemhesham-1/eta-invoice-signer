export interface LocalizedString {
    en: string;
    ar: string;
};

export interface UserResponse {
    name: {
        first: LocalizedString;
        last: LocalizedString;
    };
    jobTitle: string;
    email: string;
    department: {
        name: LocalizedString;
        type: string;
    };
};

export interface UserSession {
    name: string;
    jobTitle: string;
    email: string;
    isAuthorized: boolean;
};

export type InvoiceStatus = "SIGNED" | "READY_TO_SIGN" | "SIGNING" | "FAILED";

export interface InvoiceLineItem {
    description: string;
    unitValue: {
        currencySold: string;
    };
};

export interface Invoice {
    id: string;
    dateTimeIssued: string;
    receiver: {
        id: string;
        name: string;
    };
    invoiceLines: InvoiceLineItem[];
    internalId: string;
    status: InvoiceStatus;
    totalAmount: number;
    signatures?: unknown;
};

export interface InvoiceResponse {
    preparedInvoices: Invoice[];
};

export interface Certificate {
    id: string;
    issuedTo: string;
    issuedBy: string;
    nationalId?: string;
    expiryDate?: string;
};

interface ApiResponseSuccess<TData> {
    success: true;
    data: TData;
};

interface ApiResponseError {
    success: false;
    error: string;
    message?: string;
};

export type ApiResponse<TData = string> = ApiResponseSuccess<TData> | ApiResponseError;
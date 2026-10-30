import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { RefreshCwIcon } from "lucide-react";
import { ApiResponse, Certificate, Invoice, InvoiceResponse, InvoiceStatus } from "@/lib/types";
import { base64ToUtf8, isBase64 } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTauriListener } from "@/hooks/useTauriListener";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Checkbox } from "./ui/Checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "./ui/Field";
import { Separator } from "./ui/Separator";
import { Switch } from "./ui/Switch";
import CertificateCard from "./CertificateCard";
import InvoiceTable from "./InvoiceTable";
import SigningProgress from "./SigningProgress";
import UserProfileHeader from "./UserProfileHeader";
import SignInvoiceButton from "./SignInvoiceButton";

const DashboardView = () => {
    const { token } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [useOfficialSigner, setUseOfficialSigner] = useState(true);
    const [isSubmissionChecked, setIsSubmissionChecked] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
    const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
    const [isSigning, setIsSigning] = useState(false);
    
    const allSelected = selected.length === invoices.length;

    const signedCount = invoices?.filter((invoice) => invoice.status === "SIGNED").length || 0;

    function toggleInvoice(id: string) {
        if(selected.includes(id)) {
            setSelected((current) => current.filter((item) => item !== id));
        }
        else {
            setSelected((current) => [...current, id]);
        }
    }

    function toggleAll() {
        if(allSelected) {
            setSelected([]);
            return;
        }

        const allowedStatus = ["READY_TO_SIGN", "FAILED"];
        setSelected(invoices.filter((invoice) => allowedStatus.includes(invoice.status)).map((invoice) => invoice.id));
    }

    function updateInvoiceStatus(id: string, status: InvoiceStatus) {
        setInvoices((current) => current.map((invoice) => (invoice.id === id ? { ...invoice, status } : invoice)));
    }

    async function handleSignInvoices(tokenPin?: string) {
        if(!selectedCert || (!useOfficialSigner && tokenPin?.trim() === "")) return;

        setIsSigning(true);

        const signedInvoiceIds: string[] = [];

        for(const invoiceId of selected) {
            const foundInvoice = invoices.find((invoice) => invoice.id === invoiceId);
            if(!foundInvoice || foundInvoice.status === "SIGNED") {
                continue;
            }

            setCurrentInvoice(foundInvoice);

            try {
                updateInvoiceStatus(invoiceId, "SIGNING");

                const { id, status, signatures, ...invoiceDocument } = foundInvoice;
                const data = {
                    documents: [JSON.stringify(invoiceDocument)],
                    certificateId: selectedCert.id,
                    tokenPin
                };
                
                const result: ApiResponse<{ value: string }> = await invoke(useOfficialSigner ? "sign_invoices_itida" : "sign_invoices_native", { data });
                console.log(result);

                let statusUpdate: InvoiceStatus = result.success ? "SIGNED" : "FAILED";

                if(result.success) {
                    const signature = {
                        type: "I",
                        value: typeof result.data === "string" ? result.data : result.data.value
                    };

                    const saveResult: ApiResponse = await invoke("save_invoice_signature", { token, invoiceId, signatureData: [signature] });
                    if(!saveResult.success) {
                        statusUpdate = "FAILED";
                    }
                    else {
                        signedInvoiceIds.push(invoiceId);
                    }
                }
                else {
                    alert(result.error && isBase64(`${result.error}=`) ? base64ToUtf8(result.error) : result.error);
                }

                updateInvoiceStatus(invoiceId, statusUpdate);
            }
            catch(err) {
                updateInvoiceStatus(invoiceId, "FAILED");
                console.error(`Failed to sign invoice (${invoiceId}): `, err);
            }
        }

        if(isSubmissionChecked) {
            const submitResult: ApiResponse = await invoke("submit_invoices", { token, invoiceIds: signedInvoiceIds });
            console.log(submitResult);

            if(submitResult.success) {
                const unsignedInvoices = invoices.filter((invoice) => !signedInvoiceIds.includes(invoice.id));
                setInvoices(unsignedInvoices);
            }
        }

        setCurrentInvoice(null);
        setSelected([]);
        setIsSigning(false);
    }

    async function loadInvoices() {
        setIsLoading(true);

        try {
            const result: InvoiceResponse = await invoke("get_draft_invoices", { token });

            const invoicesData: Invoice[] = result.preparedInvoices.map((invoice) => ({ ...invoice, status: "READY_TO_SIGN" }));
            setInvoices(invoicesData);
        }
        catch(error) {
            console.error("Failed to retrieve draft invoices: ", error instanceof Error ? error?.message : error);
        }
        finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadInvoices();
    }, []);

    useTauriListener<{ value: string }>("token-pin-submitted", async (event) => {
        const pinInputWindow = WebviewWindow.getByLabel("usb-token-auth");
        await pinInputWindow.then((res) => res?.close());
        await handleSignInvoices(event.payload.value);
    });

    return (
        <main
            dir="rtl"
            className="font-arabic -mt-5 space-y-2"
        >
            <UserProfileHeader/>
            <div className="space-y-5">
                <Field orientation="horizontal">
                    <FieldContent>
                        <FieldLabel
                            htmlFor="switch-sign-method"
                            className="w-full"
                        >
                            التوقيع عبر إيتيدا (ITIDA)
                        </FieldLabel>
                        <FieldDescription>
                            قم بالتفعيل للتوقيع باستخدام أداة إيتيدا الرسمية. قم بالإلغاء للتوقيع عبر النظام الداخلي.
                        </FieldDescription>
                    </FieldContent>
                    <Switch
                        id="switch-sign-method"
                        dir="ltr"
                        className="data-checked:bg-green-500 data-unchecked:bg-slate-600"
                        checked={useOfficialSigner}
                        onCheckedChange={setUseOfficialSigner}
                    />
                </Field>
                <CertificateCard
                    certificate={selectedCert}
                    onSelectCertificate={setSelectedCert}
                    useOfficialSigner={useOfficialSigner}
                />
                {!isSigning && (
                    <>
                        <Card className="shadow-sm">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2 text-start">
                                        <CardTitle className="text-sm">
                                            الفواتير جاهزة للتوقيع
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            اختر الفواتير التي ترغب في توقيعها رقمياً.
                                        </CardDescription>
                                    </div>
                                    <Badge
                                        variant="secondary"
                                        className="px-3 py-1"
                                    >
                                        تم اختيار {selected.length}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <Separator/>
                            <CardContent className="p-0">
                                {invoices?.length > 0 ? (
                                    <InvoiceTable
                                        invoices={invoices}
                                        selected={selected}
                                        allSelected={allSelected}
                                        onToggleInvoice={toggleInvoice}
                                        onToggleAll={toggleAll}
                                    />
                                ) : (
                                    <p className="my-16 text-xl">
                                        لا توجد فواتير جاهزة للتوقيع.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                        <FieldGroup>
                            <Field orientation="horizontal">
                                <Checkbox
                                    id="eta-submit"
                                    className="cursor-pointer"
                                    checked={isSubmissionChecked}
                                    onCheckedChange={() => setIsSubmissionChecked((checked) => !checked)}
                                    disabled={isSigning}
                                />
                                <FieldContent>
                                    <FieldLabel
                                        htmlFor="eta-submit"
                                        className="text-xs"
                                    >
                                        إرسال الفواتير إلى مصلحة الضرائب المصرية (ETA)
                                    </FieldLabel>
                                    <FieldDescription className="text-xs">
                                        تفعيل هذا الخيار سيقوم برفع الفاتورة مباشرة إلى منظومة الفاتورة الإلكترونية بعد ختامها.
                                    </FieldDescription>
                                </FieldContent>
                            </Field>
                        </FieldGroup>
                        <div className="flex items-center justify-between">
                            <Button
                                variant="outline"
                                disabled={isSigning || isLoading}
                                onClick={loadInvoices}
                            >
                                <RefreshCwIcon className="size-4 me-2"/>
                                تحديث
                            </Button>
                            {selectedCert && (selected.length > 0) && (
                                <SignInvoiceButton
                                    isSigning={isSigning}
                                    totalSelected={selected.length}
                                    disabled={isSigning}
                                    className="text-sm"
                                    showPromptWindow={!useOfficialSigner}
                                    onSignClick={() => useOfficialSigner ? handleSignInvoices() : undefined}
                                />
                            )}
                        </div>
                    </>
                )}
                {isSigning && (
                    <SigningProgress
                        invoices={invoices}
                        currentInvoice={currentInvoice?.id}
                        signedCount={signedCount}
                    />
                )}
            </div>
        </main>
    );
};

export default DashboardView;
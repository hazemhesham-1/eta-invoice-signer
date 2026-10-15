import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileSignatureIcon, RefreshCwIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Separator } from "./ui/Separator";
import CertificateCard from "./CertificateCard";
import InvoiceTable from "./InvoiceTable";
import SigningProgress from "./SigningProgress";
import UserProfileHeader from "./UserProfileHeader";

const DashboardView = () => {
    const { token } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [selected, setSelected] = useState([]);

    const [isLoading, setIsLoading] = useState(false);

    const [selectedCert, setSelectedCert] = useState(null);
    const [currentInvoice, setCurrentInvoice] = useState(null);
    const [isSigning, setIsSigning] = useState(false);
    
    const allSelected = selected.length === invoices.length;

    const signedCount = invoices?.filter((invoice) => invoice.status === "SIGNED").length || 0;

    function toggleInvoice(id) {
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

    function updateInvoiceStatus(id, status) {
        setInvoices((current) => current.map((invoice) => (invoice.id === id ? { ...invoice, status } : invoice)));
    }

    async function handleSignInvoices() {
        if(!selectedCert) return;

        setIsSigning(true);

        const signedInvoiceIds = [];

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
                    certificateId: selectedCert.id
                };
                
                const result = await invoke("sign_invoices", { data });
                console.log(result);

                let statusUpdate = result.success ? "SIGNED" : "FAILED";

                if(result.success) {
                    const signature = {
                        type: "I",
                        value: result.data
                    };

                    const saveResult = await invoke("save_invoice_signature", { token, invoiceId, signatureData: [signature] });
                    if(!saveResult.success) {
                        statusUpdate = "FAILED";
                    }
                    else {
                        signedInvoiceIds.push(invoiceId);
                    }
                }
                else {
                    alert(/\s/.test(result.error) ? result.error : atob(result.error));
                }

                updateInvoiceStatus(invoiceId, statusUpdate);
            }
            catch(err) {
                updateInvoiceStatus(invoiceId, "FAILED");
                console.error(`Failed to sign invoice (${invoiceId}): `, err);
            }
        }

        // const submitResult = await invoke("submit_invoices", { token, invoiceIds: signedInvoiceIds });
        if(submitResult.success) {
            const unsignedInvoices = invoices.filter((invoice) => !signedInvoiceIds.includes(invoice.id));
            setInvoices(unsignedInvoices);
        }

        setCurrentInvoice(null);
        setSelected([]);
        setIsSigning(false);
    }

    async function loadInvoices() {
        setIsLoading(true);

        try {
            const result = await invoke("get_draft_invoices", { token });

            const invoicesData = result.preparedInvoices.map((invoice) => ({ ...invoice, status: "READY_TO_SIGN" }));
            setInvoices(invoicesData);
        }
        catch(error) {
            console.error("Failed to retrieve draft invoices: ", error?.message);
        }
        finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadInvoices();
    }, []);

    return (
        <main
            dir="rtl"
            className="font-arabic -mt-5 space-y-2"
        >
            <UserProfileHeader/>
            <div className="space-y-5">
                <CertificateCard
                    certificate={selectedCert}
                    onSelectCertificate={setSelectedCert}
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
                        <div className="flex items-center justify-between">
                            <Button
                                variant="outline"
                                disabled={isSigning || isLoading}
                                onClick={loadInvoices}
                            >
                                <RefreshCwIcon className="size-4 me-2"/>
                                تحديث
                            </Button>
                            {(selected.length > 0) && (
                                <Button
                                    size="lg"
                                    disabled={isSigning || !selectedCert}
                                    onClick={handleSignInvoices}
                                    className="text-sm"
                                >
                                    <FileSignatureIcon className="size-4 me-2"/>
                                    {isSigning ? "جاري التوقيع..." : `توقيع ${(selected.length !== 1) ? `${selected.length} فواتير` : "فاتورة واحدة"}`}
                                </Button>
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
import { useEffect, useState } from "react";
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

const sampleData = [
    {
        rawData: {
        "issuer": {
        "address": {
        "branchID": "0",
        "country": "EG",
        "governate": "Cairo",
        "regionCity": "El Nozha",
        "street": "و مربع 1226 عمارات شركه مصر الجديده خلف شيراتون النزهه",
        "buildingNumber": "5",
        "postalCode": null,
        "floor": null,
        "room": null,
        "landmark": null,
        "additionalInformation": " "
        },
        "type": "B",
        "id": "753317052",
        "name": "ايتوس لتقنيات المياه والتشغيل والصيانه"
        },
        "receiver": {
        "address": {
        "country": "EG",
        "governate": "Cairo",
        "regionCity": "New Cairo 1",
        "street": "و35و36 ش التسعين التجمع الخامس القاهره الجديده",
        "buildingNumber": "34",
        "postalCode": "4730110",
        "floor": null,
        "room": null,
        "landmark": null,
        "additionalInformation": " "
        },
        "type": "B",
        "id": "204962420",
        "name": "الشركه المصريه للغازات الطبيعيه جاسكو الشركه المصريه للغازات الطبيعيه جاسكو"
        },
        "documentType": "i",
        "documentTypeVersion": "1.0",
        "dateTimeIssued": "2026-08-16T09:48:31Z",
        "taxpayerActivityCode": "3600",
        "internalID": "1707",
        "payment": {},
        "delivery": {},
        "invoiceLines": [
        {
        "description": "زيارة إشراف علي التشغيل\n",
        "itemType": "EGS",
        "itemCode": "EG-753317052-1",
        "unitType": "EA",
        "quantity": 1,
        "internalCode": "",
        "salesTotal": 10000,
        "total": 11100,
        "valueDifference": 0,
        "totalTaxableFees": 0,
        "netTotal": 10000,
        "itemsDiscount": 0,
        "unitValue": {
        "currencySold": "EGP",
        "amountEGP": 10000,
        "amountSold": 0
        },
        "discount": {},
        "taxableItems": [
        {
        "taxType": "T1",
        "amount": 1400,
        "subType": "V009",
        "rate": 14
        },
        {
        "taxType": "T4",
        "amount": 300,
        "subType": "W004",
        "rate": 3
        }
        ]
        }
        ],
        "totalDiscountAmount": 0,
        "totalSalesAmount": 10000,
        "netAmount": 10000,
        "taxTotals": [
        {
        "taxType": "T1",
        "amount": 1400
        },
        {
        "taxType": "T4",
        "amount": 300
        }
        ],
        "totalAmount": 11100,
        "extraDiscountAmount": 0,
        "totalItemsDiscountAmount": 0,
        "references": []
        }
    }
]

const DashboardView = () => {
    const { token } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selected, setSelected] = useState([]);

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
        setSelected(invoices.filter((invoice) => allowedStatus.includes(invoice.status)).map((invoice) => invoice._id));
    }

    async function handleSignInvoices() {
        if(!selectedCert) return;

        setIsSigning(true);

        for(const invoiceId of selected) {
            const signingInvoice = invoices.find((invoice) => invoice._id === invoiceId);
            setCurrentInvoice(signingInvoice);
            setInvoices((current) => current.map((invoice) => (invoice._id === invoiceId ? { ...invoice, status: "SIGNING" } : invoice)));

            const result = await window.electronAPI.signInvoices({ documents: [JSON.stringify(signingInvoice)], certificateId: selectedCert.id });
            console.log(result);

            setInvoices((current) => current.map((invoice) => (invoice._id === invoiceId ? { ...invoice, status: result.success ? "SIGNED" : "FAILED" } : invoice)));
        }

        setCurrentInvoice(null);
        setSelected([]);
        setIsSigning(false);
    }

    async function loadInvoices() {
        try {
            setIsLoading(true);
            const result = await window.electronAPI.listInvoices(token);

            const invoicesData = result.data.map((invoice) => ({ ...invoice, status: "READY_TO_SIGN" }));
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
                        currentInvoice={currentInvoice?._id}
                        signedCount={signedCount}
                    />
                )}
            </div>
        </main>
    );
};

export default DashboardView;
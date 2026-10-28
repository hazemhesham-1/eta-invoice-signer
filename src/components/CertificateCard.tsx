import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApiResponse, Certificate } from "@/lib/types";
import { base64ToUtf8, isBase64 } from "@/lib/utils";
import { CheckCircle2Icon, RefreshCwIcon, ReplaceIcon, ShieldCheckIcon, UsbIcon } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/Select";
import TokenHardwareAlert from "./TokenHardwareAlert";

interface CertificateCardProps {
    certificate: Certificate | null;
    onSelectCertificate: (cert: Certificate | null) => void;
    useOfficialSigner?: boolean;
};

const CertificateCard = ({ certificate, onSelectCertificate, useOfficialSigner = true }: CertificateCardProps) => {
    const [isTokenConnected, setIsTokenConnected] = useState(false);
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    async function fetchCertificates() {
        const response: ApiResponse<string> = await invoke(useOfficialSigner ? "list_certificates_itida" : "list_certificates_native");

        if(response.success) {
            const data = isBase64(response.data) ? base64ToUtf8(response.data) : response.data;
            const parsedData = JSON.parse(data);

            const certificateList = parsedData?.map((cert: Record<string, string>) => ({
                id: cert.CertThumprint,
                issuedBy: cert.IssuedBy,
                issuedTo: cert.IssuedTo ?? "",
                nationalId: cert.NationalID ?? "",
                expiryDate: cert.ExpirationDate
            })) || [];

            return certificateList;
        }

        return [];
    }

    async function handleVerifyToken() {
        setIsRefreshing(true);

        try {
            const status: ApiResponse = await invoke("get_usb_token");
            setIsTokenConnected(status.success);

            if(status.success) {
                const certResult = await fetchCertificates();
                setCertificates(certResult);
            }
            else {
                console.log(status.message || "Failed to get usb slots with tokens");
            }
        }
        catch(err) {
            console.error(err);
            alert("Error checking usb harware token");
        }
        finally {
            setIsRefreshing(false);
        }
    }

    function handleSelectCertificate(certId: string | null) {
        const newCertificate = certificates.find((cert) => cert.id === certId);
        onSelectCertificate?.(newCertificate ?? null);
    }

    return (
        <div className="space-y-2">
            {!isTokenConnected && <TokenHardwareAlert/>}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            <div className="bg-primary/10 text-primary rounded-lg flex items-center justify-center size-10">
                                <ShieldCheckIcon className="size-5"/>
                            </div>
                            <div className="space-y-1 text-start">
                                <CardTitle className="text-sm">
                                    الشهادة الرقمية
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    الشهادة المستخدمة لتوقيع فواتير مصلحة الضرائب المصرية.
                                </CardDescription>
                            </div>
                        </div>
                        {certificate && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSelectCertificate?.(null)}
                            >
                                <ReplaceIcon className="size-3.5 me-2"/>
                                تغيير الشهادة
                            </Button>
                        )}
                        {(!certificate || !isTokenConnected) && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleVerifyToken}
                                disabled={isRefreshing}
                            >
                                <RefreshCwIcon className="size-3.5 me-2"/>
                                تحديث
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {!isTokenConnected || !certificates.length ? (
                        <div className="border border-dashed rounded-lg p-6 text-center">
                            <UsbIcon className="text-muted-foreground size-8 mx-auto mb-3"/>
                            <p className="font-medium">
                                لم يتم العثور على فلاشة التوقيع
                            </p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                يرجى توصيل فلاشة التوقيع (USB Token) ثم اضغط تحديث.
                            </p>
                        </div>
                    ) : !certificate ? (
                        <Select
                            defaultValue=""
                            onValueChange={handleSelectCertificate}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="اختر شهادة التوقيع"/>
                            </SelectTrigger>
                            <SelectContent>
                                {certificates.map((certificate) => (
                                    <SelectItem
                                        key={certificate.id}
                                        value={certificate.id}
                                    >
                                        {certificate.issuedTo} ({certificate.issuedBy})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="bg-muted/30 border rounded-lg flex items-center gap-4 p-4">
                            <div className="bg-green-100 text-green-700 rounded-full flex items-center justify-center size-10">
                                <CheckCircle2Icon className="size-5"/>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">
                                        {certificate.issuedTo}
                                    </p>
                                    <Badge
                                        variant="outline"
                                        className="bg-green-50 text-green-700 border-green-200"
                                    >
                                        صالحة
                                    </Badge>
                                </div>
                                <div className="text-muted-foreground flex gap-6 mt-1 text-xs">
                                    <span>
                                        الرقم القومي: {certificate.nationalId || "---"}
                                    </span>
                                    <span>
                                        صالحة حتى: {certificate.expiryDate}
                                    </span>
                                    <span>
                                        جهة الإصدار: {certificate.issuedBy}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CertificateCard;
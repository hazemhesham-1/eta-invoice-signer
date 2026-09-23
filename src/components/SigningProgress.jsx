import { CheckCircle2Icon, FileSignatureIcon } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Progress } from "./ui/Progress";

const SigningProgress = ({ currentInvoice, invoices, signedCount }) => {
    const progress = Math.round((signedCount / invoices.length) * 100);

    return (
        <Card className="border-primary/20">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-2 text-start">
                        <CardTitle className="text-sm">
                            جاري توقيع الفواتير
                        </CardTitle>
                        <CardDescription className="text-xs">
                            برجاء عدم إزالة فلاشة التوقيع (USB Token).
                        </CardDescription>
                    </div>
                    <Badge variant="secondary">
                        <span dir="ltr">
                            {signedCount} / {invoices.length}
                        </span>
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <Progress value={progress}/>
                <div className="border rounded-lg divide-y">
                    {invoices.map((invoice) => {
                        const isCurrent = invoice._id === currentInvoice;

                        return (
                            <div
                                key={invoice._id}
                                className="flex items-center justify-between px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <FileSignatureIcon className={["size-4", isCurrent ? "text-primary" : "text-muted-foreground"].join(" ")}/>
                                    <span className="text-sm font-medium">
                                        {invoice.internalId}
                                    </span>
                                </div>

                                {(invoice.status === "SIGNED") && (
                                    <span className="text-green-600 flex items-center gap-1.5 text-xs font-medium">
                                        <CheckCircle2Icon className="size-4"/>
                                        تم التوقيع
                                    </span>
                                )}
                                {isCurrent && (
                                    <span className="text-primary flex items-center gap-1.5 text-xs font-medium">
                                        <span className="bg-primary rounded-full size-2 animate-pulse"/>
                                        جاري التوقيع...
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default SigningProgress;
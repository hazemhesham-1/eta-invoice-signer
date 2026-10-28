import { CheckCircle2Icon } from "lucide-react";
import { InvoiceStatus } from "@/lib/types";
import { Badge } from "./ui/Badge";

const InvoiceStatusBadge = ({ status }: { status: InvoiceStatus }) => {
    if(status === "READY_TO_SIGN") {
        return (
            <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200"
            >
                جاهزة
            </Badge>
        );
    }
    else if(status === "SIGNING") {
        return (
            <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
            >
                جاري التوقيع...
            </Badge>
        );
    }
    else if(status === "SIGNED") {
        return (
            <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200"
            >
                <CheckCircle2Icon className="size-3 me-1"/>
                تم التوقيع
            </Badge>
        );
    }
    
    return <Badge variant="destructive">فشل</Badge>;
};

export default InvoiceStatusBadge;
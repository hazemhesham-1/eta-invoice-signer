import { FileCheck2Icon } from "lucide-react";
import { truncateName } from "@/lib/utils";
import { Checkbox } from "./ui/Checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/Table";
import InvoiceStatusBadge from "./InvoiceStatusBadge";

const InvoiceTable = ({ invoices, selected, allSelected, onToggleAll, onToggleInvoice }) => {
    return (
        <Table>
            <TableHeader>
                <TableRow className="text-sm first:bg-transparent!">
                    <TableHead className="w-12">
                        <Checkbox
                            checked={allSelected}
                            onCheckedChange={onToggleAll}
                        />
                    </TableHead>
                    <TableHead>
                        رقم الفاتورة
                    </TableHead>
                    <TableHead>
                        العميل
                    </TableHead>
                    <TableHead>
                        الوصف
                    </TableHead>
                    <TableHead className="text-right">
                        المبلغ
                    </TableHead>
                    <TableHead>
                        التاريخ
                    </TableHead>
                    <TableHead>
                        الحالة
                    </TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
                {invoices.map((invoice) => (
                    <TableRow
                        key={invoice.id}
                        className={selected.includes(invoice.id) ? "bg-primary/10" : undefined}
                    >
                        <TableCell>
                            <Checkbox
                                checked={selected.includes(invoice.id)}
                                onCheckedChange={() => onToggleInvoice(invoice.id)}
                                disabled={invoice.status !== "READY_TO_SIGN" && invoice.status !== "FAILED"}
                            />
                        </TableCell>

                        <TableCell>
                            <div className="flex items-center gap-2">
                                <div className="bg-muted rounded-md flex items-center justify-center size-8">
                                    <FileCheck2Icon className="text-muted-foreground size-4"/>
                                </div>
                                <span className="font-medium">
                                    {invoice.internalId}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell title={invoice.receiver.name}>
                            <div className="text-start">
                                <p className="text-xs font-medium">
                                    {truncateName(invoice.receiver.name, 5)}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    {invoice.receiver.id}
                                </p>
                            </div>
                        </TableCell>
                        <TableCell className="text-xs text-start">
                            {invoice.invoiceLines[0]?.description}
                        </TableCell>
                        <TableCell className="text-start font-medium">
                            {invoice.totalAmount.toLocaleString("en-EG")}{" "}
                            <span className="text-muted-foreground text-xs">
                                {invoice.invoiceLines[0]?.unitValue.currencySold}
                            </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                            {new Date(invoice.dateTimeIssued).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                            <InvoiceStatusBadge status={invoice.status}/>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default InvoiceTable;
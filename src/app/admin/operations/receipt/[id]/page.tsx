import { notFound, redirect } from "next/navigation";
import PrintQuotationButton from "@/components/PrintQuotationButton";
import { canManageSettings, getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const money = (value: unknown) => `₹${Number(String(value ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function CustomerReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (!canManageSettings(admin)) redirect("/admin");
  const { id } = await params;
  const payment = await prisma.customerPayment.findUnique({ where: { id }, include: { job: { include: { customer: true } }, schedule: true } });
  if (!payment) notFound();
  return <main className="quotation-document">
    <div className="print-toolbar"><a href="/admin/operations">← Back to operations</a><PrintQuotationButton /></div>
    <header className="quotation-document-header"><div className="quotation-brand"><span>N.S.</span><div><strong>N.S. CONSTRUCTION</strong><small>PAYMENT ACKNOWLEDGEMENT</small></div></div><div className="quotation-company"><strong>{payment.job.siteLocation}</strong><span>{payment.paidAt.toLocaleDateString("en-IN")}</span></div></header>
    <section className="quotation-title-block"><div><span className="section-index">CUSTOMER ACCOUNT / RECEIPT</span><h1>Payment<br/><em>receipt</em></h1></div><div className="quotation-number"><span>RECEIPT NUMBER</span><strong>{payment.receiptNo}</strong><span>STATUS · {payment.status}</span><span>DATE · {payment.paidAt.toLocaleDateString("en-IN")}</span></div></section>
    <section className="quotation-parties"><div><span>RECEIVED FROM</span><h2>{payment.job.customer?.name || "Customer"}</h2><p>{payment.job.customer?.phone || ""}</p></div><div><span>PROJECT</span><h2>{payment.job.name}</h2><p>{payment.job.jobNo} · {payment.job.siteLocation}</p></div></section>
    <section className="quotation-document-section"><div className="quotation-section-title"><span>01</span><h2>Payment details</h2></div><div className="quotation-cost-table"><div><span>Amount received / recorded</span><strong>{money(payment.amount)}</strong></div><div><span>Payment method</span><strong>{payment.method.replaceAll("_", " ")}</strong></div><div><span>Transaction reference</span><strong>{payment.reference || "Not provided"}</strong></div><div><span>Payment milestone</span><strong>{payment.schedule?.title || "General project payment"}</strong></div><div><span>Payment status</span><strong>{payment.status}</strong></div><div className="quotation-cost-total"><span>Receipt amount</span><strong>{money(payment.amount)}</strong></div></div><p>{payment.notes || "Thank you for your payment."}</p></section>
    <section className="quotation-acceptance"><div><span>FOR N.S. CONSTRUCTION</span><div className="quotation-signature-line"/><small>Authorised representative</small></div><div><span>CUSTOMER ACKNOWLEDGEMENT</span><div className="quotation-signature-line"/><small>Name and signature</small></div></section>
    <footer className="quotation-document-footer"><strong>N.S. CONSTRUCTION</strong><span>This receipt reflects the recorded payment status. A pending payment is not a confirmation of cleared funds.</span></footer>
  </main>;
}

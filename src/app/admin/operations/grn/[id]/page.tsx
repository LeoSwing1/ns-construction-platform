import { notFound, redirect } from "next/navigation";
import PrintQuotationButton from "@/components/PrintQuotationButton";
import { canManageSettings, getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const money = (value: unknown) => `₹${Number(String(value ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function GoodsReceivedNotePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (!canManageSettings(admin)) redirect("/admin");
  const { id } = await params;
  const delivery = await prisma.purchaseDelivery.findUnique({ where: { id }, include: { purchaseOrder: { include: { supplier: true, job: { include: { customer: true } } } }, items: { include: { purchaseOrderItem: true } } } });
  if (!delivery) notFound();
  const total = delivery.items.reduce((sum, line) => sum + Number(line.quantityReceived) * Number(line.purchaseOrderItem.unitRate), 0);
  return <main className="quotation-document">
    <div className="print-toolbar"><a href="/admin/operations">← Back to operations</a><PrintQuotationButton /></div>
    <header className="quotation-document-header"><div className="quotation-brand"><span>N.S.</span><div><strong>N.S. CONSTRUCTION</strong><small>GOODS RECEIVED NOTE</small></div></div><div className="quotation-company"><strong>{delivery.purchaseOrder.job.siteLocation}</strong><span>{delivery.deliveredAt.toLocaleDateString("en-IN")}</span></div></header>
    <section className="quotation-title-block"><div><span className="section-index">PROCUREMENT / STORE RECORD</span><h1>Goods received<br/><em>note</em></h1></div><div className="quotation-number"><span>GRN REFERENCE</span><strong>{delivery.deliveryRef || delivery.id.slice(-10).toUpperCase()}</strong><span>PO · {delivery.purchaseOrder.poNumber}</span><span>DATE · {delivery.deliveredAt.toLocaleDateString("en-IN")}</span></div></section>
    <section className="quotation-parties"><div><span>SUPPLIER</span><h2>{delivery.purchaseOrder.supplier.companyName}</h2><p>{delivery.purchaseOrder.supplier.contactPerson || ""}</p><p>{delivery.purchaseOrder.supplier.phone || ""}</p></div><div><span>PROJECT / JOB</span><h2>{delivery.purchaseOrder.job.name}</h2><p>{delivery.purchaseOrder.job.jobNo}</p><p>{delivery.purchaseOrder.job.customer?.name || "Customer not linked"}</p></div></section>
    <section className="quotation-document-section"><div className="quotation-section-title"><span>01</span><h2>Items received</h2></div><table className="quotation-spec-table"><thead><tr><th>Description</th><th>Ordered unit</th><th>Received qty</th><th>Unit rate</th><th>Line value</th></tr></thead><tbody>{delivery.items.map((line)=><tr key={line.id}><td>{line.purchaseOrderItem.description}</td><td>{line.purchaseOrderItem.unit}</td><td>{Number(line.quantityReceived).toLocaleString("en-IN")}</td><td>{money(line.purchaseOrderItem.unitRate)}</td><td>{money(Number(line.quantityReceived)*Number(line.purchaseOrderItem.unitRate))}</td></tr>)}</tbody></table><div className="quotation-cost-total"><span>Received goods value (before allocated tax)</span><strong>{money(total)}</strong></div></section>
    <section className="quotation-document-section"><div className="quotation-section-title"><span>02</span><h2>Receiving confirmation</h2></div><p><strong>Received by:</strong> {delivery.receivedBy}</p><p><strong>Delivery reference:</strong> {delivery.deliveryRef || "Not provided"}</p><p><strong>Notes / condition:</strong> {delivery.notes || "No additional notes recorded."}</p>{delivery.attachmentUrl && <p><strong>Attachment:</strong> {delivery.attachmentUrl}</p>}</section>
    <section className="quotation-acceptance"><div><span>STORE / SITE RECEIVER</span><div className="quotation-signature-line"/><small>{delivery.receivedBy}</small></div><div><span>SUPPLIER / DELIVERY REPRESENTATIVE</span><div className="quotation-signature-line"/><small>Name and signature</small></div></section>
    <footer className="quotation-document-footer"><strong>N.S. CONSTRUCTION</strong><span>Internal procurement record · retain with supplier invoice and purchase order</span></footer>
  </main>;
}

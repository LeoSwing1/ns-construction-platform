"use client";

export default function PrintQuotationButton() {
  return <button className="print-quotation-button" type="button" onClick={() => window.print()}>Print / Save as PDF</button>;
}

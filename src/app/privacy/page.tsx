import { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Privacy policy | N.S. Construction", robots: { index: false } };

export default function Privacy() {
  return <main className="privacy-copy">
    <Link className="plain-link" href="/">← N.S. Construction</Link>
    <div className="section-index">YOUR INFORMATION / PRIVACY</div>
    <h1>Privacy policy</h1>
    <p><strong>Draft for business review.</strong> Before collecting live enquiries, N.S. Construction should confirm the legal business identity, privacy contact, retention periods and applicable local requirements. This notice describes the current website form at a high level and must be reviewed before production launch.</p>
    <h2>Information you provide</h2>
    <p>Project consultation requests may include your name, phone number, email address, project type, location, approximate area, floor count, budget range, requested services, proposed timeline, project description and attachments.</p>
    <p>Construction estimate requests may also include property type, plot and construction areas, selected construction package, material specifications and client requirements. Quotations are linked to enquiry records in the customer relationship system. A secure, unlisted quotation link is issued so the customer can view or print their estimate; anyone with that link may be able to access the quotation, so it should be handled as private.</p>
    <h2>How information is used</h2>
    <p>Details are used to review and respond to project requests, coordinate follow-up and maintain a record of the enquiry. Access to enquiry records should be limited to authorised team members.</p>
    <h2>Service providers</h2>
    <p>If configured, this website uses Resend to deliver email notifications, Cloudinary to store uploaded project documents and optional Google Analytics or Meta Pixel technologies only after analytics consent. These providers process information according to their respective terms and privacy notices. Integrations are not considered active unless configured and tested.</p>
    <h2>Retention and your choices</h2>
    <p>The business must set a retention period for enquiries and uploaded files before launch. Contact the business through the details on this website to request access, correction or deletion, subject to applicable record-keeping requirements.</p>
    <h2>Contact</h2>
    <p>For a privacy question, contact N.S. Construction by phone at +91 88407 51012. A dedicated privacy email address should be added after the business confirms it.</p>
    <p>Last updated: November 2026. This draft is not legal advice.</p>
  </main>;
}

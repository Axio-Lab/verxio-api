import type { Metadata } from "next";
import { LegalPageLayout } from "@/app/app-components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service | Verxio",
  description: "Verxio Terms of Service – rules and conditions for using our platform.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" description="Last updated: February 2026">
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Verxio (&quot;Service&quot;), you agree to be bound by these Terms
          of Service (&quot;Terms&quot;). If you do not agree, do not use the Service. We may update
          these Terms from time to time; continued use after changes constitutes acceptance.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          Verxio provides an AI-powered workflow automation platform that allows you to design, run,
          and manage automated workflows, including integrations with third-party services (e.g.,
          Google Calendar, Gmail, Sheets) via OAuth. Your chat conversations with the AI are stored
          to provide continuity and are encrypted at rest where enabled to protect against
          unauthorized access and privacy leaks. We grant you a limited, non-exclusive, revocable
          license to use the Service in accordance with these Terms and our policies.
        </p>
      </section>

      <section>
        <h2>3. Account and Eligibility</h2>
        <p>
          You must be at least 18 years old (or the age of majority in your jurisdiction) and
          provide accurate registration information. You are responsible for keeping your
          credentials secure and for all activity under your account. You must notify us promptly of
          any unauthorized use.
        </p>
      </section>

      <section>
        <h2>4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any illegal purpose or in violation of any laws.</li>
          <li>
            Violate others&apos; rights (e.g., privacy, intellectual property) or abuse third-party
            services you connect (e.g., Google APIs) in a way that breaches their terms.
          </li>
          <li>
            Attempt to gain unauthorized access to our systems, other accounts, or any third-party
            systems.
          </li>
          <li>Transmit malware, spam, or any harmful or disruptive content.</li>
          <li>
            Resell, sublicense, or commercially exploit the Service beyond permitted use without our
            written consent.
          </li>
          <li>
            Use the Service in a manner that could harm, overload, or impair the Service or
            others&apos; use of it.
          </li>
        </ul>
        <p>
          We may suspend or terminate your access if we reasonably believe you have violated these
          Terms or applicable policies.
        </p>
      </section>

      <section>
        <h2>5. Intellectual Property</h2>
        <p>
          Verxio and its content, features, and technology (excluding your data and workflows) are
          owned by us or our licensors. You retain ownership of your workflows and content you
          provide. You grant us a license to use, host, and process your content as necessary to
          provide and improve the Service.
        </p>
      </section>

      <section>
        <h2>6. Third-Party Services</h2>
        <p>
          The Service may integrate with third-party services (e.g., Google). Your use of those
          services is subject to their respective terms and privacy policies. We are not responsible
          for their availability, actions, or policies. You are responsible for complying with their
          terms when using them through Verxio.
        </p>
      </section>

      <section>
        <h2>7. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
          OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
          GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
        </p>
      </section>

      <section>
        <h2>8. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, VERXIO AND ITS AFFILIATES, OFFICERS, EMPLOYEES,
          AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO
          YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THE
          SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRIOR TO THE
          CLAIM (OR ONE HUNDRED U.S. DOLLARS IF GREATER).
        </p>
      </section>

      <section>
        <h2>9. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Verxio and its affiliates from any claims,
          damages, losses, or expenses (including reasonable attorneys&apos; fees) arising from your
          use of the Service, your content, your violation of these Terms, or your violation of any
          third-party rights.
        </p>
      </section>

      <section>
        <h2>10. Termination</h2>
        <p>
          You may stop using the Service and close your account at any time. We may suspend or
          terminate your access or the Service with or without notice for breach of these Terms, for
          legal or operational reasons, or at our discretion. Upon termination, your right to use
          the Service ceases. Provisions that by their nature should survive (e.g., disclaimers,
          limitation of liability, indemnification) will survive.
        </p>
      </section>

      <section>
        <h2>11. Governing Law and Disputes</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which Verxio operates, without
          regard to conflict-of-law principles. Any dispute shall be resolved in the courts of that
          jurisdiction, unless otherwise required by applicable law.
        </p>
      </section>

      <section>
        <h2>12. Changes</h2>
        <p>
          We may modify these Terms at any time. We will post the updated Terms on this page and
          update the &quot;Last updated&quot; date. Material changes may be communicated via email
          or in-product notice. Your continued use of the Service after changes constitutes
          acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>For questions about these Terms of Service, contact us at:</p>
        <p className="mt-2">
          <strong>Verxio</strong>
          <br />
          Email:{" "}
          <a href="mailto:support@verxio.xyz" className="text-primary hover:underline">
            support@verxio.xyz
          </a>
        </p>
      </section>
    </LegalPageLayout>
  );
}

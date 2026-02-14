import type { Metadata } from "next";
import { LegalPageLayout } from "@/app/app-components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | Verxio",
  description: "Verxio Privacy Policy – how we collect, use, store, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" description="Last updated: February 2026">
      <section>
        <h2>1. Introduction</h2>
        <p>
          Verxio (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Verxio platform,
          an AI-powered workflow automation service. This Privacy Policy describes how we collect,
          use, store, and share information when you use our website and services, including when
          you connect third-party accounts (e.g., Google) via OAuth. By using Verxio, you agree to
          this policy.
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <p>We collect information you provide and data we receive from connected services:</p>
        <ul>
          <li>
            <strong>Account data:</strong> email address, name, and password (hashed) when you sign
            up.
          </li>
          <li>
            <strong>OAuth / third-party data:</strong> When you connect Google or other services, we
            receive and store access tokens and the scoped data those services provide (e.g.,
            calendar events, sheets, Gmail) only to perform the actions you request in your
            workflows.
          </li>
          <li>
            <strong>Usage data:</strong> workflow runs, node executions, and general usage of the
            platform to operate and improve our services.
          </li>
          <li>
            <strong>Chat and conversation data:</strong> When you use the in-app AI assistant or
            plan workflows via chat, we store your conversation history (messages you send and
            responses from the AI) to provide continuity and improve the service. This data is
            encrypted at rest when encryption is enabled on our systems to reduce the risk of
            privacy leaks.
          </li>
          <li>
            <strong>Technical data:</strong> IP address, browser type, and device information for
            security and support.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, operate, and maintain the Verxio platform and your workflows.</li>
          <li>
            Execute workflows that use connected services (e.g., create calendar events, send
            emails) according to your configuration.
          </li>
          <li>Authenticate you and manage your account and connected credentials.</li>
          <li>
            Send you service-related communications (e.g., verification emails, security alerts).
          </li>
          <li>Improve our product, fix errors, and ensure security and compliance.</li>
          <li>Comply with applicable law and enforce our terms.</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Sharing and Disclosure</h2>
        <p>We do not sell your personal information. We may share data only in these cases:</p>
        <ul>
          <li>
            <strong>Service providers:</strong> With vendors that help us host, analyze, or operate
            our service (under strict data-processing terms).
          </li>
          <li>
            <strong>Third-party APIs:</strong> When you use integrations (e.g., Google Calendar,
            Gmail), we send only the data necessary to perform the requested action, in accordance
            with each provider&apos;s policies and your consent.
          </li>
          <li>
            <strong>Legal:</strong> When required by law, court order, or to protect our rights and
            safety.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Data Storage and Security</h2>
        <p>
          We store your data on secure servers and use industry-standard measures (encryption,
          access controls) to protect it. OAuth tokens and sensitive credentials are stored
          encrypted. Your chat conversations with the AI (workflow planning and assistant messages)
          are encrypted at rest using strong encryption (AES-256-GCM) where enabled, so that stored
          conversation content is protected against unauthorized access and privacy leaks.
          Communication with our servers uses TLS in transit. We retain data as long as your account
          is active or as needed for legal and operational purposes.
        </p>
      </section>

      <section>
        <h2>6. Cookies and Similar Technologies</h2>
        <p>
          We use cookies and similar technologies for session management, authentication, and
          preferences. You can control cookies through your browser settings; some features may not
          work if you disable them.
        </p>
      </section>

      <section>
        <h2>7. Your Rights and Choices</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access, correct, or delete your personal data.</li>
          <li>Export your data.</li>
          <li>Object to or restrict certain processing.</li>
          <li>Withdraw consent (e.g., disconnect OAuth accounts from your Verxio account).</li>
        </ul>
        <p>
          You can disconnect third-party accounts and delete your Verxio account from your account
          settings. For other requests, contact us using the details below.
        </p>
      </section>

      <section>
        <h2>8. Third-Party Services (e.g., Google)</h2>
        <p>
          When you connect Google or other OAuth services, their use of your data is governed by
          their respective privacy policies (e.g., Google Privacy Policy). We request only the
          scopes needed for the features you use (e.g., calendar, Gmail) and use the data only to
          run your workflows and as described in this policy.
        </p>
      </section>

      <section>
        <h2>9. Children</h2>
        <p>
          Our service is not directed at children under 13 (or higher age where required). We do not
          knowingly collect personal information from children.
        </p>
      </section>

      <section>
        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the revised policy on
          this page and update the &quot;Last updated&quot; date. Continued use of Verxio after
          changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section>
        <h2>11. Contact Us</h2>
        <p>
          For privacy-related questions, access or deletion requests, or to report a concern,
          contact us at:
        </p>
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

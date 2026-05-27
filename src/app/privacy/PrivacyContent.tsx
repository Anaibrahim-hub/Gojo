'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyContent() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="bg-white shadow px-4 lg:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Privacy Policy</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 lg:p-10 space-y-8">

          <div>
            <p className="text-sm text-gray-400">Last updated: May 2025</p>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Your privacy matters to us. This policy explains what information Yevilla collects, how we use it,
              and the choices you have.
            </p>
          </div>

          <Section title="1. Information We Collect">
            <p><strong>Account information</strong></p>
            <ul>
              <li>When you sign in with Google, we receive your name, email address, and profile photo from Google.</li>
              <li>When you sign in with an email link, we store your email address.</li>
              <li>Authentication is handled by Firebase Authentication (Google). We do not store your password.</li>
            </ul>
            <p className="mt-3"><strong>Listings and content</strong></p>
            <ul>
              <li>Property details, descriptions, and photos you submit when creating a listing.</li>
              <li>Your saved favourites (a list of property IDs linked to your account).</li>
            </ul>
            <p className="mt-3"><strong>Usage data</strong></p>
            <ul>
              <li>Property view counts are tracked anonymously (no personal identifier is stored with a view).</li>
              <li>We use rate-limiting data stored in Cloudflare KV to prevent abuse; this is keyed by IP address and expires automatically.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul>
              <li>To authenticate you and maintain your session.</li>
              <li>To display and manage your property listings.</li>
              <li>To save and restore your favourites across devices.</li>
              <li>To contact you about your listing status (approval, rejection).</li>
              <li>To prevent fraud, abuse, and unauthorised access.</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties.</p>
          </Section>

          <Section title="3. Data Storage and Security">
            <p>
              Your data is stored on secure, industry-standard cloud infrastructure. We take reasonable technical
              and organisational measures to protect your information against unauthorised access, loss, or
              disclosure. Property photos are served over a secure CDN and are publicly accessible only via the
              URL associated with an active listing.
            </p>
            <p className="mt-3">
              While we strive to protect your data, no method of transmission over the internet is 100% secure.
              We encourage you to use strong, unique credentials for any accounts you use to access Yevilla.
            </p>
          </Section>

          <Section title="4. Cookies and Local Storage">
            <p>
              Yevilla uses browser local storage to remember your email for the email sign-in flow. We do not
              use tracking cookies or third-party advertising cookies.
            </p>
          </Section>

          <Section title="5. Photos and Public Content">
            <p>
              Property photos you upload are stored in Cloudflare R2 and served publicly via a CDN. Anyone with
              the URL can view them. If your listing is deleted, its associated photos are permanently removed
              from storage.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <ul>
              <li>Listing data and photos are retained as long as the listing exists. Deleting a listing removes all associated data.</li>
              <li>Favourite lists are retained until you remove them or delete your account.</li>
              <li>Authentication records in Firebase are subject to Google&apos;s retention policies.</li>
              <li>Rate-limit records in Cloudflare KV expire automatically after a short window.</li>
            </ul>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access</strong> the personal data we hold about you.</li>
              <li><strong>Correct</strong> inaccurate data by updating your listing or account.</li>
              <li><strong>Delete</strong> your listings and the data associated with them at any time.</li>
              <li><strong>Withdraw consent</strong> by stopping use of the platform and requesting account deletion.</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, please contact us via our{' '}
              <a href="/contact" className="text-blue-600 hover:underline">Contact page</a>.
            </p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>
              Yevilla is not directed at children under the age of 18. We do not knowingly collect personal
              information from minors. If you believe a minor has provided us with personal data, please
              contact us so we can remove it.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy periodically. We will post the revised version with an updated
              date at the top of this page. Continued use of the platform after changes are posted constitutes
              your acceptance of the updated policy.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              For privacy-related questions or requests, please reach out via our{' '}
              <a href="/contact" className="text-blue-600 hover:underline">Contact page</a>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </div>
    </div>
  )
}

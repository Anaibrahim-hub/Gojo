'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'

type PolicySection = { title: string; body: string }

const FALLBACK_SECTIONS: PolicySection[] = [
  {
    title: '1. Information We Collect',
    body: [
      '<strong>Account information</strong>',
      '<ul>',
      '<li>When you sign in with Google, we receive your name, email address, and profile photo from Google.</li>',
      '<li>When you sign in with Apple, we receive your name and email address (or a private relay address) from Apple.</li>',
      '<li>When you sign in with an email link, we store your email address in browser local storage temporarily to complete the sign-in flow.</li>',
      '<li>Authentication is handled by Firebase Authentication. We do not store passwords.</li>',
      '</ul>',
      '<strong>Listings and content</strong>',
      '<ul>',
      '<li>Property details, descriptions, and photos you submit when creating a listing.</li>',
      '<li>Your saved favourites (a list of property IDs linked to your account).</li>',
      '</ul>',
      '<strong>Usage data</strong>',
      '<ul>',
      '<li>Property view counts are tracked anonymously — no personal identifier is stored alongside a view.</li>',
      '<li>We use rate-limiting data stored in Cloudflare KV, keyed by IP address, to prevent abuse. These records expire automatically after a short window.</li>',
      '</ul>',
    ].join('\n'),
  },
  {
    title: '2. How We Use Your Information',
    body: [
      '<ul>',
      '<li>To authenticate you and maintain your session.</li>',
      '<li>To display and manage your property listings.</li>',
      '<li>To save and restore your favourites across devices.</li>',
      '<li>To contact you about your listing status (approval, rejection, or enquiries).</li>',
      '<li>To prevent fraud, abuse, and unauthorised access to the platform.</li>',
      '</ul>',
      '<p>We do <strong>not</strong> sell your personal information to third parties, and we do <strong>not</strong> use your data for advertising purposes.</p>',
    ].join('\n'),
  },
  {
    title: '3. How We Share Your Information',
    body: [
      '<ul>',
      '<li><strong>Published listings are public.</strong> Any property listing you publish on Yevilla is visible to all visitors, including your contact information if provided.</li>',
      '<li><strong>Service providers.</strong> We share data with Firebase (authentication and database), Google Sign-In, Apple Sign-In, Mapbox (map tiles and geocoding), and Cloudflare (CDN, Workers, and R2 storage) solely to operate the platform. These providers are bound by their own data-processing agreements.</li>',
      '<li><strong>Legal disclosures.</strong> We may disclose your information when required by law, court order, or to protect the rights, property, or safety of Yevilla, its users, or the public.</li>',
      '</ul>',
    ].join('\n'),
  },
  {
    title: '4. Data Storage and Security',
    body: [
      '<p>Your account and listing data are stored in Firebase Firestore and Firebase Authentication, both operated by Google on secure, industry-standard infrastructure.</p>',
      '<p>Property photos are stored in Cloudflare R2 and served via Cloudflare\'s CDN over TLS. Photos associated with an active listing are publicly accessible to anyone with the URL. If a listing is deleted, its associated photos are permanently removed from storage.</p>',
      '<p>Our API is served through Cloudflare Workers. All data in transit between your browser and our services is encrypted using TLS.</p>',
      '<p>While we apply reasonable technical and organisational safeguards, no internet transmission is 100% secure. We encourage you to protect your Google or Apple account with a strong password and two-factor authentication.</p>',
    ].join('\n'),
  },
  {
    title: '5. Cookies and Local Storage',
    body: [
      '<p>Yevilla uses <strong>browser local storage</strong> for one purpose only: to temporarily store your email address during the email-link sign-in flow. This value is cleared once sign-in is complete.</p>',
      '<p>We do <strong>not</strong> use tracking cookies, session cookies, or any third-party advertising or analytics cookies.</p>',
    ].join('\n'),
  },
  {
    title: '6. Data Retention',
    body: [
      '<ul>',
      '<li>Listing data and photos are retained for as long as the listing exists. Deleting a listing removes all associated data and photos permanently.</li>',
      '<li>Favourite lists are retained until you remove individual items or delete your account.</li>',
      '<li>Authentication records in Firebase are subject to Google\'s retention policies. You can request deletion via the Your Rights section below.</li>',
      '<li>Rate-limit records in Cloudflare KV expire automatically after a short time window and are not linked to your account.</li>',
      '</ul>',
    ].join('\n'),
  },
  {
    title: '7. Your Rights',
    body: [
      '<p>You have the right to:</p>',
      '<ul>',
      '<li><strong>Access</strong> the personal data we hold about you.</li>',
      '<li><strong>Correct</strong> inaccurate data by editing your listing or account profile.</li>',
      '<li><strong>Delete</strong> your listings, favourites, and account at any time via the platform settings.</li>',
      '<li><strong>Withdraw consent</strong> by stopping use of the platform and requesting full account deletion.</li>',
      '</ul>',
      '<p>To exercise any of these rights, please contact us via our <a href="/contact" class="text-blue-600 hover:underline">Contact page</a>.</p>',
    ].join('\n'),
  },
  {
    title: "8. Children's Privacy",
    body: '<p>Yevilla is not directed at children under the age of 18. We do not knowingly collect personal information from minors. If you believe a minor has provided us with personal data, please contact us immediately so we can remove it.</p>',
  },
  {
    title: '9. Changes to This Policy',
    body: '<p>We may update this Privacy Policy periodically. We will post the revised version with an updated date at the top of this page. Continued use of the platform after changes are posted constitutes your acceptance of the updated policy.</p>',
  },
  {
    title: '10. Contact',
    body: '<p>For privacy-related questions or requests, please reach out via our <a href="/contact" class="text-blue-600 hover:underline">Contact page</a>.</p>',
  },
]

export default function PrivacyContent() {
  const router = useRouter()
  const [effectiveDate, setEffectiveDate] = useState('June 1, 2026')
  const [sections, setSections] = useState<PolicySection[]>(FALLBACK_SECTIONS)

  useEffect(() => {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
    if (!workerUrl) return
    fetch(`${workerUrl}/legal?platform=gojo&type=privacy`)
      .then((res) => res.json())
      .then((data) => {
        if (
          data &&
          typeof data.effectiveDate === 'string' &&
          Array.isArray(data.sections) &&
          data.sections.length > 0 &&
          data.sections.every(
            (s: unknown) =>
              s !== null &&
              typeof s === 'object' &&
              typeof (s as Record<string, unknown>).title === 'string' &&
              typeof (s as Record<string, unknown>).body === 'string'
          )
        ) {
          setEffectiveDate(data.effectiveDate)
          setSections(data.sections)
        }
      })
      .catch(() => {
        // silently fall back to hardcoded content
      })
  }, [])

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
            <p className="text-sm text-gray-400">Last updated: {effectiveDate}</p>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Your privacy matters to us. This policy explains what information Yevilla collects,
              how we use it, and the choices you have.
            </p>
          </div>

          {sections.map((section) => (
            <Section key={section.title} title={section.title}>
              <div dangerouslySetInnerHTML={{ __html: section.body }} />
            </Section>
          ))}

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

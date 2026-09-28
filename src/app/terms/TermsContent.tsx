'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'

type PolicySection = { title: string; body: string }

const FALLBACK_SECTIONS: PolicySection[] = [
  {
    title: '1. About Yevilla',
    body: '<p>Yevilla is an online real estate marketplace that connects property owners, agents, and prospective buyers or tenants in Ethiopia. We provide tools to browse, list, and enquire about residential and commercial properties across the country.</p>',
  },
  {
    title: '2. Eligibility',
    body: '<p>You must be at least 18 years old to create an account or submit a listing. By using Yevilla, you represent that you meet this requirement and that all information you provide is accurate and truthful.</p>',
  },
  {
    title: '3. User Accounts',
    body: [
      '<ul>',
      '<li>You may sign in using Google or a verified email link. One account per person is permitted.</li>',
      '<li>You are responsible for maintaining the security of your account and for all activity that occurs under it.</li>',
      '<li>We reserve the right to suspend or terminate accounts that violate these Terms or that we reasonably believe are being used fraudulently or harmfully.</li>',
      '</ul>',
    ].join('\n'),
  },
  {
    title: '4. Listings and Content',
    body: [
      '<p>When you submit a listing or any content to Yevilla, you agree that:</p>',
      '<ul>',
      '<li>All information is accurate, current, and not misleading.</li>',
      '<li>You own or have the legal right and authority to list the property.</li>',
      '<li>Photos are of the actual property and are not stock images or taken from other sources without permission.</li>',
      '<li>The listing complies with all applicable Ethiopian laws and regulations.</li>',
      '</ul>',
    ].join('\n'),
  },
  {
    title: '5. Prohibited Conduct',
    body: [
      '<p>You agree not to:</p>',
      '<ul>',
      '<li>Post fraudulent, false, or misleading listings or information.</li>',
      '<li>Scrape, copy, or systematically distribute content from Yevilla without written permission.</li>',
      '<li>Use the platform to harass, defraud, or harm other users.</li>',
      '<li>Attempt to circumvent security measures or access accounts that are not yours.</li>',
      '<li>Use automated tools, bots, or scripts to access, query, or submit data to the platform.</li>',
      '<li>Impersonate any person, agent, or entity, or misrepresent your affiliation with any person or organisation.</li>',
      '</ul>',
    ].join('\n'),
  },
  {
    title: '6. Moderation',
    body: '<p>Yevilla reserves the right to reject, remove, or edit any listing or content at our sole discretion, including but not limited to listings that violate these Terms, contain inaccurate information, or that we otherwise deem inappropriate or harmful to the community.</p>',
  },
  {
    title: '7. One Listing per Standard User',
    body: '<p>Standard (unverified) users may have one active property listing at a time. That listing is subject to manual review before publication. Verified agents may publish multiple listings without per-listing manual review, subject to the responsibilities described in Section 8.</p>',
  },
  {
    title: '8. Verified Agents',
    body: [
      '<p>Real estate agents may apply for a Verified Agent badge, which grants the ability to publish multiple listings. As a verified agent you agree to:</p>',
      '<ul>',
      '<li>Maintain the accuracy and legality of all your listings.</li>',
      '<li>Respond promptly to enquiries from prospective buyers or tenants.</li>',
      '<li>Notify us when a property is no longer available so listings can be removed.</li>',
      '</ul>',
      '<p>Yevilla reserves the right to revoke verified-agent status at any time for conduct that violates these Terms or that undermines trust in the platform.</p>',
    ].join('\n'),
  },
  {
    title: '9. Intellectual Property',
    body: [
      '<p>All content on Yevilla that is not user-generated — including the design, logo, text, and software — is owned by Yevilla and may not be reproduced without written permission.</p>',
      '<p>By submitting photos or other content, you grant Yevilla a non-exclusive, royalty-free licence to display that content on our platform for the duration your listing is active. You retain ownership of your content.</p>',
    ].join('\n'),
  },
  {
    title: '10. Disclaimers',
    body: [
      '<p>Yevilla is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied.</p>',
      '<ul>',
      '<li>We do not endorse any listing, property, agent, or user on the platform.</li>',
      '<li>We do not provide real estate, legal, or financial advice. Any information on the platform is for general informational purposes only.</li>',
      '<li>We do not verify the accuracy of listing details, the legal status of properties, or the identity of users beyond basic authentication.</li>',
      '</ul>',
      '<p>All transactions, agreements, or arrangements made between users are solely the responsibility of those parties.</p>',
    ].join('\n'),
  },
  {
    title: '11. Limitation of Liability',
    body: '<p>To the fullest extent permitted by applicable law, Yevilla and its operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of — or inability to use — the platform, including but not limited to losses resulting from reliance on listing information, failed transactions, or unauthorised account access.</p>',
  },
  {
    title: '12. Indemnification',
    body: '<p>You agree to indemnify and hold harmless Yevilla and its operators from and against any claims, damages, losses, and expenses (including reasonable legal fees) arising out of or relating to your use of the platform, your listings or other content, or your violation of these Terms.</p>',
  },
  {
    title: '13. Account Termination',
    body: [
      '<ul>',
      '<li><strong>By you:</strong> You may delete your account at any time via the Settings page. Deleting your account removes your profile, listings, and favourites.</li>',
      '<li><strong>By us:</strong> We may suspend or terminate your account if we determine that you have violated these Terms, engaged in fraudulent activity, or are otherwise using the platform in a manner harmful to other users or to Yevilla.</li>',
      '</ul>',
    ].join('\n'),
  },
  {
    title: '14. Governing Law',
    body: '<p>These Terms are governed by the laws of the Federal Democratic Republic of Ethiopia. Any disputes arising from or relating to these Terms or your use of the platform shall be resolved in the courts of Addis Ababa, Ethiopia.</p>',
  },
  {
    title: '15. Changes to These Terms',
    body: '<p>We may update these Terms of Service from time to time. Continued use of the platform after changes are posted constitutes your acceptance of the updated Terms. We will note the revision date at the top of this page.</p>',
  },
  {
    title: '16. Contact',
    body: '<p>If you have questions about these Terms of Service, please reach out via our <a href="/contact" class="text-blue-600 hover:underline">Contact page</a>.</p>',
  },
]

export default function TermsContent() {
  const router = useRouter()
  const [effectiveDate, setEffectiveDate] = useState('June 1, 2026')
  const [sections, setSections] = useState<PolicySection[]>(FALLBACK_SECTIONS)

  useEffect(() => {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
    if (!workerUrl) return
    fetch(`${workerUrl}/legal?platform=gojo&type=terms`)
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
        <h1 className="text-xl font-bold text-gray-900">Terms of Service</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 lg:p-10 space-y-8">

          <div>
            <p className="text-sm text-gray-400">Last updated: {effectiveDate}</p>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Welcome to Yevilla. By accessing or using our platform, you agree to be bound by
              these Terms of Service. Please read them carefully before using our services.
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

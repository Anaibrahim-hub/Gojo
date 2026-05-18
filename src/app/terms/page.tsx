'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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
        <h1 className="text-xl font-bold text-gray-900">Terms of Use</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 lg:p-10 space-y-8">

          <div>
            <p className="text-sm text-gray-400">Last updated: May 2025</p>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Welcome to Yevilla. By accessing or using our platform, you agree to be bound by these Terms of Service.
              Please read them carefully before using our services.
            </p>
          </div>

          <Section title="1. About Yevilla">
            <p>
              Yevilla is an online real estate marketplace that connects property owners, agents, and prospective
              buyers or tenants in Ethiopia. We provide tools to browse, list, and enquire about residential and
              commercial properties.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 18 years old to create an account or submit a listing. By using Yevilla, you
              represent that you meet this requirement and that all information you provide is accurate and truthful.
            </p>
          </Section>

          <Section title="3. User Accounts">
            <ul>
              <li>You may sign in using Google or a verified email link.</li>
              <li>You are responsible for maintaining the security of your account.</li>
              <li>
                Regular users may submit one property listing, which is reviewed before publication. Verified
                agents may publish multiple listings without manual review.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that violate these terms or that we believe
                are being used fraudulently.
              </li>
            </ul>
          </Section>

          <Section title="4. Listings and Content">
            <p>When you submit a listing or any content to Yevilla, you agree that:</p>
            <ul>
              <li>All information is accurate, current, and not misleading.</li>
              <li>You own or have the legal right to list the property.</li>
              <li>Photos are of the actual property and are not stock images or taken from other sources without permission.</li>
              <li>The listing does not violate any applicable Ethiopian laws or regulations.</li>
            </ul>
            <p className="mt-3">
              Yevilla reserves the right to reject, remove, or edit any listing that violates these terms or that
              we deem inappropriate, at our sole discretion.
            </p>
          </Section>

          <Section title="5. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul>
              <li>Post fraudulent, false, or misleading listings or information.</li>
              <li>Scrape, copy, or distribute content from Yevilla without permission.</li>
              <li>Use the platform to harass, defraud, or harm other users.</li>
              <li>Attempt to circumvent security measures or access accounts that are not yours.</li>
              <li>Use automated tools to access, query, or submit data to the platform.</li>
            </ul>
          </Section>

          <Section title="6. Intellectual Property">
            <p>
              All content on Yevilla that is not user-generated — including the design, logo, text, and software —
              is owned by Yevilla and may not be reproduced without written permission.
            </p>
            <p className="mt-3">
              By submitting photos or other content, you grant Yevilla a non-exclusive, royalty-free licence to
              display that content on our platform for the duration your listing is active.
            </p>
          </Section>

          <Section title="7. Disclaimer of Warranties">
            <p>
              Yevilla is provided &quot;as is&quot; without warranties of any kind. We do not verify the accuracy of
              listing details, the legal status of properties, or the identity of users beyond basic
              authentication. All transactions, agreements, or arrangements made between users are solely the
              responsibility of those parties.
            </p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>
              To the fullest extent permitted by law, Yevilla and its operators shall not be liable for any
              indirect, incidental, or consequential damages arising from your use of the platform, including
              but not limited to losses resulting from reliance on listing information.
            </p>
          </Section>

          <Section title="9. Changes to These Terms">
            <p>
              We may update these Terms of Service from time to time. Continued use of the platform after
              changes are posted constitutes your acceptance of the updated terms. We will note the revision
              date at the top of this page.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These terms are governed by the laws of the Federal Democratic Republic of Ethiopia. Any disputes
              shall be resolved in the courts of Addis Ababa, Ethiopia.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              If you have questions about these Terms of Service, please reach out via our{' '}
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

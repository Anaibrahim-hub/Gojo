'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Home } from 'lucide-react'

export default function SellHomeView() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  return (
    <div className="size-full flex flex-col">
      {/* Header */}
      <div className="bg-white shadow px-4 lg:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <Home className="w-5 h-5 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">Sell Your Property</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">Sell with Confidence</p>
            <p className="text-sm text-blue-700">
              Submit your property details below. A Gojo verified agent will review your submission
              and contact you within 24 hours for authentication and next steps.
            </p>
          </div>

          {/* Main Form Card */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sell Your Property</h2>
            <p className="text-gray-600 mb-6">Provide details for agent verification</p>

            {/* Contact Information */}
            <h3 className="text-lg font-bold text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="+251 9X XXX XXXX"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Best Time to Reach You</label>
                <select className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                  <option value="">Select a time</option>
                  <option>Morning 8am–12pm</option>
                  <option>Afternoon 12pm–5pm</option>
                  <option>Evening 5pm–8pm</option>
                </select>
              </div>
            </div>

            {/* Property Information */}
            <h3 className="text-lg font-bold text-gray-900 mb-4">Property Information</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
              <input
                type="text"
                placeholder="Full street address"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sub-city</label>
                <input
                  type="text"
                  placeholder="e.g. Bole"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Woreda</label>
                <input
                  type="text"
                  placeholder="e.g. Woreda 03"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
                <select className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                  <option value="">Select type</option>
                  <option>House</option>
                  <option>Condo</option>
                  <option>Townhouse</option>
                  <option>Multi-family</option>
                  <option>Commercial</option>
                  <option>Land</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year Built</label>
                <input
                  type="number"
                  placeholder="e.g. 2015"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bedrooms</label>
                <input
                  type="number"
                  placeholder="e.g. 3"
                  min={0}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bathrooms</label>
                <input
                  type="number"
                  placeholder="e.g. 2"
                  min={0}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Square Meters</label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  min={0}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lot Size (sqm)</label>
                <input
                  type="number"
                  placeholder="e.g. 300"
                  min={0}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asking Price (Br)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000000"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Mortgage Balance (Br)</label>
                <input
                  type="number"
                  placeholder="0 if none"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Selling</label>
              <select className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                <option value="">Select reason</option>
                <option>Relocation</option>
                <option>Upgrading</option>
                <option>Downsizing</option>
                <option>Financial</option>
                <option>Other</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Details</label>
              <textarea
                rows={4}
                placeholder="Any extra information about your property..."
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Timeline */}
            <h3 className="text-lg font-bold text-gray-900 mb-4">Timeline &amp; Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">When do you want to sell?</label>
                <select className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                  <option value="">Select timeline</option>
                  <option>ASAP</option>
                  <option>1–3 months</option>
                  <option>3–6 months</option>
                  <option>6–12 months</option>
                  <option>Just exploring</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Currently</label>
                <select className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                  <option value="">Select status</option>
                  <option>Owner Occupied</option>
                  <option>Tenant Occupied</option>
                  <option>Vacant</option>
                </select>
              </div>
            </div>

            {/* Agreement */}
            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={authorized}
                onChange={() => setAuthorized((v) => !v)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">
                I authorize Gojo and its verified agents to contact me about my property and the
                selling process.
              </span>
            </label>

            <button
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all"
            >
              Submit for Agent Review
            </button>

            <p className="text-xs text-gray-400 mt-4">
              * Required fields. All information is kept confidential and secure.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

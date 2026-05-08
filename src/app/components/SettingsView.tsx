'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function SettingsView() {
  const router = useRouter()
  const { user } = useAuth()

  return (
    <div className="size-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-100 px-4 lg:px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Account Settings */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Account Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  defaultValue={user?.displayName ?? ''}
                  placeholder="Your full name"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  defaultValue={user?.email ?? ''}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  placeholder="+251 91 000 0000"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-500">Receive updates about new listings</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Price Drop Alerts</p>
                  <p className="text-sm text-gray-500">Get notified when prices drop</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">New Listings in My Area</p>
                  <p className="text-sm text-gray-500">Be the first to see new properties</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Saved Search Alerts</p>
                  <p className="text-sm text-gray-500">Updates matching your saved searches</p>
                </div>
                <input type="checkbox" className="w-5 h-5 accent-blue-600" />
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Privacy</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Show Profile to Agents</p>
                  <p className="text-sm text-gray-500">Allow agents to view your profile</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Share Activity Data</p>
                  <p className="text-sm text-gray-500">Help us improve recommendations</p>
                </div>
                <input type="checkbox" className="w-5 h-5 accent-blue-600" />
              </div>
            </div>
          </div>

          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all">
            Save Changes
          </button>

        </div>
      </div>
    </div>
  )
}

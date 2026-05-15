'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Phone, MapPin, Clock, Loader2, CheckCircle } from 'lucide-react'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

interface ContactInfo {
  phone: string | null
  email: string | null
  address: string | null
  office_hours: string | null
}

export default function ContactView() {
  const router = useRouter()
  const [info, setInfo] = useState<ContactInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!WORKER_URL) { setLoading(false); return }
    fetch(`${WORKER_URL}/contact`)
      .then(r => r.ok ? r.json() as Promise<ContactInfo> : Promise.reject())
      .then(data => setInfo(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in Name, Email, and Message.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${WORKER_URL}/submit-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          fields: { Name: name, Email: email, Subject: subject, Message: message },
        }),
      })
      if (!res.ok) throw new Error()
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const items = [
    { icon: Phone,  label: 'Phone',        value: info?.phone },
    { icon: Mail,   label: 'Email',        value: info?.email },
    { icon: MapPin, label: 'Address',      value: info?.address },
    { icon: Clock,  label: 'Office Hours', value: info?.office_hours },
  ]

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
        <h1 className="text-xl font-bold text-gray-900">Contact Us</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Contact Form */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Send Us a Message</h2>

            {submitted ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
                <p className="text-lg font-semibold text-gray-800">Message sent!</p>
                <p className="text-sm text-gray-500">We&apos;ll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      placeholder="Your full name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <input
                    type="text"
                    placeholder="How can we help?"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                  <textarea
                    rows={5}
                    placeholder="Write your message here..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>


        </div>
      </div>
    </div>
  )
}

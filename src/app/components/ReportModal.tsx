'use client'

import React, { useState } from 'react'
import { Flag } from 'lucide-react'
import { auth } from '@/lib/firebase'

const REASONS: { label: string; value: string }[] = [
  { label: 'Spam', value: 'spam' },
  { label: 'Misleading Information', value: 'misleading' },
  { label: 'Already Sold / Unavailable', value: 'unavailable' },
  { label: 'Copyright Infringement', value: 'copyright' },
]

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

interface ReportModalProps {
  open: boolean
  onClose: () => void
  targetType: 'listing' | 'user'
  targetId: string
}

export default function ReportModal({ open, onClose, targetType, targetId }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  if (!open) return null

  function reset() {
    setSelectedReason(null)
    setDetails('')
    setLoading(false)
    setMessage(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedReason) return
    setLoading(true)
    setMessage(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${WORKER_URL}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetType,
          targetId,
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      setMessage({ text: 'Report submitted. Thank you for letting us know.', ok: true })
      setTimeout(() => { reset(); onClose() }, 2000)
    } catch {
      setLoading(false)
      setMessage({ text: 'Failed to submit report. Please try again.', ok: false })
    }
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <Flag className="w-5 h-5 text-red-500 shrink-0" />
          <h2 className="text-lg font-bold text-gray-900">Report this listing</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
                  selectedReason === r.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={selectedReason === r.value}
                  onChange={() => setSelectedReason(r.value)}
                  className="sr-only"
                />
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedReason === r.value ? 'border-white' : 'border-gray-400'
                  }`}
                >
                  {selectedReason === r.value && (
                    <span className="w-2 h-2 rounded-full bg-white block" />
                  )}
                </span>
                <span className="text-sm font-medium">{r.label}</span>
              </label>
            ))}
          </div>

          <div>
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-all"
              placeholder="Additional details (optional)"
              rows={3}
              maxLength={500}
              value={details}
              onChange={e => setDetails(e.target.value)}
            />
            {details.length > 0 && (
              <p className="text-xs text-gray-400 text-right mt-1">{details.length} / 500</p>
            )}
          </div>

          {message && (
            <p className={`text-sm font-medium ${message.ok ? 'text-green-600' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedReason || loading}
              className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

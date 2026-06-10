import type { Metadata } from 'next'
import { Suspense } from 'react'
import SellHomeView from '@/app/components/SellHomeView'

export const metadata: Metadata = {
  title: 'Sell Your Home with Yevilla',
  description: 'List your property for sale on Yevilla and connect with serious buyers across Ethiopia. Fast publishing, photo uploads, and agent tools.',
  alternates: { canonical: 'https://yevilla.com/sell-my-home' },
}

export default function SellMyHomePage() {
  return (
    <div className="size-full flex flex-col" style={{ height: '100vh' }}>
      <Suspense>
        <SellHomeView />
      </Suspense>
    </div>
  )
}

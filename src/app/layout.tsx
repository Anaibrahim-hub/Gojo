import type { Metadata } from 'next'
import '../styles/index.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: 'Real Estate Platform Design',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ height: '100%', margin: 0 }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}

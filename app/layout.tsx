import type { Metadata } from 'next'
import { IBM_Plex_Sans, Chivo, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const ibmPlex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex',
})

const chivo = Chivo({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-chivo',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'CareerPilot — Career Operating System',
  description: 'AI-powered career OS for senior data and cloud professionals',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${ibmPlex.variable} ${chivo.variable} ${jetbrains.variable}`}>
        {children}
      </body>
    </html>
  )
}

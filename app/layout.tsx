import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { ProfileProvider } from "@/components/layout/ProfileContext"
import { ThemeProvider } from "@/components/layout/ThemeProvider"
import { Header } from "@/components/layout/Header"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

export const metadata: Metadata = {
  title: "FoodPlanner",
  description: "Personal meal planner for Rob & Steph",
  appleWebApp: {
    capable: true,
    title: "FoodPlanner",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/foodapp/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ProfileProvider>
            <Header />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

import type { Metadata } from "next"
import { Press_Start_2P } from "next/font/google"
import { ThemeProvider } from "next-themes"
import "./globals.css"

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Rakha Pixel - Virtual Office",
  description:
    "A pixel art virtual office showing your team as pixel characters at desks, driven by Discord presence.",
  icons: {
    icon: "/images/rakha.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${pixelFont.variable} font-pixel antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

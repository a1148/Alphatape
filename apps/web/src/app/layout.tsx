import type { Metadata } from "next";
import { Heebo, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Shell } from "@/components/shell";
import { LocaleProvider } from "@/lib/i18n";
import { AppState } from "@/lib/state";
import "./globals.css";

const heebo = Heebo({ subsets: ["latin", "hebrew"], variable: "--font-heebo" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: "AlphaTape — סורק מניות חמות",
  description: "US and Tel Aviv hot-stock scanner. Not investment advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${plex.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <script dangerouslySetInnerHTML={{ __html: "try{var l=localStorage.getItem('alphatape.locale')||'he';document.documentElement.lang=l;document.documentElement.dir=l==='he'?'rtl':'ltr';}catch(e){}" }} />
        <LocaleProvider>
          <AppState>
            <Shell>{children}</Shell>
            <Toaster theme="dark" />
          </AppState>
        </LocaleProvider>
      </body>
    </html>
  );
}

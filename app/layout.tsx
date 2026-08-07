import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { GlossaryProvider } from "@/components/GlossaryProvider";
import { EnvironmentStrip } from "@/components/EnvironmentStrip";
import { loadGlossary } from "@/lib/glossary/load";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attribute Origination Portal",
  description:
    "Turns solar electricity readings into saleable certificates, with an audit trail that holds.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const glossary = await loadGlossary(locale);

  return (
    <html lang={locale}>
      <body className="min-h-dvh">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <GlossaryProvider entries={glossary}>
            <EnvironmentStrip />
            {children}
          </GlossaryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["hy", "en"] as const;
export type Locale = (typeof locales)[number];

/**
 * English is the default locale (product decision, deviating from the build
 * guide's Armenian-first stance); Armenian remains a first-class, fully
 * translated locale one click away. The locale is a cookie rather than a URL
 * segment so users just see their language, never /en/ vs /hy/.
 */
export const defaultLocale: Locale = "en";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get("locale")?.value;
  const locale: Locale = locales.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["hy", "en"] as const;
export type Locale = (typeof locales)[number];

/**
 * Armenian is not an afterthought: hy is the default locale. The locale is a
 * cookie rather than a URL segment so a bakery owner never sees /en/ vs /hy/
 * — they just see their language.
 */
export const defaultLocale: Locale = "hy";

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

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Domain guardrail: pure business logic must never be bundled with I/O.
  // See lib/domain/README — enforced additionally by tests/architecture.test.ts
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // site photos are compressed client-side, but allow headroom
    },
  },
};

export default withNextIntl(nextConfig);

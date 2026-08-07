import { SiteWizard } from "./wizard";

/**
 * S1-2: site creation wizard. Mobile-first — a field technician creates the
 * site from a phone while standing at the installation.
 */
export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold text-ink-900">New site</h1>
      {error && (
        <p role="alert" className="mb-4 rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
      <SiteWizard />
    </div>
  );
}

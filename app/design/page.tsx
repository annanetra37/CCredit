import { DataCard } from "@/components/DataCard";
import { EmptyState } from "@/components/EmptyState";
import { InfoTip } from "@/components/InfoTip";
import { SandboxBanner } from "@/components/SandboxBanner";
import { SourceBadge } from "@/components/SourceBadge";
import { StatusPill } from "@/components/StatusPill";
import { TraceLink } from "@/components/TraceLink";
import { BilingualField } from "@/components/BilingualField";

/**
 * /design (S0-3): renders every component in every state, in lieu of
 * Storybook. Playwright visual tests screenshot this page.
 */
export default function DesignPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <h1 className="text-2xl font-bold text-ink-900">
        Design system <InfoTip termKey="sandbox_mode" />
      </h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">SandboxBanner</h2>
        <SandboxBanner />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">StatusPill — attribute lifecycle</h2>
        <div className="flex flex-wrap gap-2">
          {["MEASURED","RECONCILED","DISPUTED","ELIGIBLE","ALLOCATED","ISSUED","TRANSFERRED","REDEEMED","VOID"].map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
        <h2 className="mb-3 mt-4 text-sm font-semibold uppercase tracking-wide text-ink-500">StatusPill — site lifecycle</h2>
        <div className="flex flex-wrap gap-2">
          {["LEAD","QUALIFYING","CONTRACTED","METERED","COMMISSIONED","ASSESSED","PRODUCING","SUSPENDED","TERMINATED"].map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">SourceBadge — manual is loud on purpose</h2>
        <div className="flex flex-wrap gap-2">
          <SourceBadge source="MANUAL" />
          <SourceBadge source="METER" />
          <SourceBadge source="INVERTER_API" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <DataCard layer="measurement" title="Measurement" infoKey="reconciliation">
          <p className="text-sm">Readings, devices, reconciliation — mist.</p>
          <p className="mt-2"><TraceLink value="10.0000" unit="MWh" href="/design" /></p>
        </DataCard>
        <DataCard layer="energy" title="Energy" infoKey="i_rec">
          <p className="text-sm">Generation, MWh, I-RECs — peach.</p>
        </DataCard>
        <DataCard layer="carbon" title="Carbon" infoKey="grid_emission_factor">
          <p className="text-sm">Factors, calculations, VCUs — lilac.</p>
          <p className="mt-2"><TraceLink value="43.6" unit="tCO₂e" href="/design" /></p>
        </DataCard>
        <DataCard layer="commercial" title="Commercial">
          <p className="text-sm">Contracts, buyers, payouts — sand.</p>
        </DataCard>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">EmptyState</h2>
        <EmptyState
          title="No disputed periods"
          explanation="Everything reconciles within tolerance. Disputed periods appear here with all three source values, deltas, and calibration status pre-attached."
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">BilingualField</h2>
        <BilingualField
          label="Term"
          hy={<p className="rounded-input bg-surface-2 p-2 text-sm">Հավելյալություն</p>}
          en={<p className="rounded-input bg-surface-2 p-2 text-sm">Additionality</p>}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">InfoTip states</h2>
        <p className="text-sm text-ink-900">
          Known key: additionality <InfoTip termKey="additionality" /> · Missing key (dev warning):
          <InfoTip termKey="not_a_real_key" />
        </p>
      </section>
    </main>
  );
}

"use client";

/**
 * Site creation wizard (S1-2): identity → technical → location → review.
 * GPS captured from the device with manual override; the draft survives
 * connection loss via localStorage; duplicate warnings on matching owner
 * tax ID are re-checked authoritatively server-side.
 */
import { useEffect, useRef, useState } from "react";
import { StepFlow } from "@/components/StepFlow";
import { InfoTip } from "@/components/InfoTip";
import { createSiteAction } from "@/lib/actions/sites";

const DRAFT_KEY = "site-wizard-draft";

interface Draft {
  name: string;
  ownerLegalName: string;
  ownerTaxId: string;
  capacityKw: string;
  inverterMake: string;
  inverterModel: string;
  moduleMake: string;
  moduleModel: string;
  tiltDeg: string;
  orientationDeg: string;
  lat: string;
  lon: string;
  address: string;
  isSandbox: boolean;
}

const empty: Draft = {
  name: "",
  ownerLegalName: "",
  ownerTaxId: "",
  capacityKw: "",
  inverterMake: "",
  inverterModel: "",
  moduleMake: "",
  moduleModel: "",
  tiltDeg: "",
  orientationDeg: "",
  lat: "",
  lon: "",
  address: "",
  isSandbox: true,
};

export function SiteWizard() {
  const [draft, setDraft] = useState<Draft>(empty);
  const formRef = useRef<HTMLFormElement>(null);

  // Draft is saved locally and survives connection loss mid-wizard.
  useEffect(() => {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) setDraft({ ...empty, ...(JSON.parse(stored) as Partial<Draft>) });
  }, []);
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function captureGps() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      set("lat", pos.coords.latitude.toFixed(6));
      set("lon", pos.coords.longitude.toFixed(6));
    });
  }

  const input =
    "min-h-11 w-full rounded-input border border-ink-200 bg-surface-1 px-3 text-ink-900";
  const label = "flex flex-col gap-1 text-sm font-medium text-ink-700";

  return (
    <form ref={formRef} action={createSiteAction}>
      {Object.entries(draft).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
      <StepFlow
        onComplete={() => {
          localStorage.removeItem(DRAFT_KEY);
          formRef.current?.requestSubmit();
        }}
        steps={[
          {
            key: "identity",
            title: "Identity",
            validate: () =>
              draft.name.length < 2
                ? "Site name is required."
                : draft.ownerLegalName.length < 2
                  ? "Owner legal name is required."
                  : draft.ownerTaxId.length < 3
                    ? "Owner tax ID is required."
                    : null,
            content: (
              <div className="flex flex-col gap-3">
                <label className={label}>
                  Site name
                  <input className={input} value={draft.name} onChange={(e) => set("name", e.target.value)} />
                </label>
                <label className={label}>
                  Owner legal name
                  <input className={input} value={draft.ownerLegalName} onChange={(e) => set("ownerLegalName", e.target.value)} />
                </label>
                <label className={label}>
                  Owner tax ID
                  <input className={input} value={draft.ownerTaxId} onChange={(e) => set("ownerTaxId", e.target.value)} />
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink-700">
                  <input
                    type="checkbox"
                    checked={draft.isSandbox}
                    onChange={(e) => set("isSandbox", e.target.checked)}
                    className="h-5 w-5"
                  />
                  Sandbox site <InfoTip termKey="sandbox_mode" />
                </label>
              </div>
            ),
          },
          {
            key: "technical",
            title: "Technical",
            validate: () =>
              !draft.capacityKw || Number(draft.capacityKw) <= 0
                ? "Capacity (kW) is required."
                : null,
            content: (
              <div className="flex flex-col gap-3">
                <label className={label}>
                  Capacity (kW)
                  <input type="number" step="0.01" className={input} value={draft.capacityKw} onChange={(e) => set("capacityKw", e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={label}>
                    Inverter make
                    <input className={input} value={draft.inverterMake} onChange={(e) => set("inverterMake", e.target.value)} />
                  </label>
                  <label className={label}>
                    Inverter model
                    <input className={input} value={draft.inverterModel} onChange={(e) => set("inverterModel", e.target.value)} />
                  </label>
                  <label className={label}>
                    Module make
                    <input className={input} value={draft.moduleMake} onChange={(e) => set("moduleMake", e.target.value)} />
                  </label>
                  <label className={label}>
                    Module model
                    <input className={input} value={draft.moduleModel} onChange={(e) => set("moduleModel", e.target.value)} />
                  </label>
                  <label className={label}>
                    Tilt (°)
                    <input type="number" className={input} value={draft.tiltDeg} onChange={(e) => set("tiltDeg", e.target.value)} />
                  </label>
                  <label className={label}>
                    Orientation (°)
                    <input type="number" className={input} value={draft.orientationDeg} onChange={(e) => set("orientationDeg", e.target.value)} />
                  </label>
                </div>
              </div>
            ),
          },
          {
            key: "location",
            title: "Location",
            content: (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={captureGps}
                  className="min-h-11 rounded-input bg-mist px-4 text-sm font-semibold text-teal-600"
                >
                  📍 Capture GPS from this device
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <label className={label}>
                    Latitude
                    <input className={`${input} numeric`} value={draft.lat} onChange={(e) => set("lat", e.target.value)} />
                  </label>
                  <label className={label}>
                    Longitude
                    <input className={`${input} numeric`} value={draft.lon} onChange={(e) => set("lon", e.target.value)} />
                  </label>
                </div>
                <label className={label}>
                  Address
                  <input className={input} value={draft.address} onChange={(e) => set("address", e.target.value)} />
                </label>
              </div>
            ),
          },
          {
            key: "review",
            title: "Review",
            content: (
              <dl className="flex flex-col gap-2 text-sm">
                {[
                  ["Site", draft.name],
                  ["Owner", `${draft.ownerLegalName} (${draft.ownerTaxId})`],
                  ["Capacity", `${draft.capacityKw} kW`],
                  ["Location", draft.lat ? `${draft.lat}, ${draft.lon}` : draft.address || "—"],
                  ["Mode", draft.isSandbox ? "🧪 Sandbox" : "Production"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-ink-200 pb-1">
                    <dt className="text-ink-500">{k}</dt>
                    <dd className="text-right font-medium text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
            ),
          },
        ]}
      />
    </form>
  );
}

/**
 * <DataCard> — tinted section container (§4.4). The `layer` prop drives the
 * tint: colour encodes which layer of the pipeline the user is in (§4.2).
 *   measurement → mist · energy → peach · carbon → lilac · commercial → sand
 */
import type { ReactNode } from "react";
import type { Layer } from "@/lib/design/tokens";
import { InfoTip } from "./InfoTip";

const LAYER_BG: Record<Layer, string> = {
  measurement: "bg-mist",
  energy: "bg-peach",
  carbon: "bg-lilac",
  commercial: "bg-surface-2",
};

const LAYER_ACCENT: Record<Layer, string> = {
  measurement: "text-teal-600",
  energy: "text-apricot-700",
  carbon: "text-lilac-700",
  commercial: "text-ink-700",
};

export function DataCard({
  layer,
  title,
  infoKey,
  children,
  actions,
}: {
  layer: Layer;
  title: string;
  infoKey?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={`rounded-card ${LAYER_BG[layer]} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold uppercase tracking-wide ${LAYER_ACCENT[layer]}`}>
          {title}
          {infoKey && <InfoTip termKey={infoKey} />}
        </h3>
        {actions}
      </div>
      <div className="rounded-input bg-surface-1 p-4 shadow-soft">{children}</div>
    </section>
  );
}

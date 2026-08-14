import { createElement } from "react";

type CenterSnapshotView = {
  asOfMs: string;
  resources: Array<{ kind: string; balanceMicro: string; lastReason?: string }>;
  facilities: Array<{ id: string; kind: string; level: number; priority: number; estimateMicroPerHour: { numerator: string; denominator: string } }>;
  energy: { status: string; availableMicroPerHour: string; demandMicroPerHour: string; explanation: string };
};

export interface AppShellProps {
  title: string;
}

export function AppShell({ title }: AppShellProps) {
  return createElement("main", { "aria-label": title }, createElement("h1", null, title));
}

function formatEstimate(estimate: { numerator: string; denominator: string }): string {
  return estimate.denominator === "1" ? estimate.numerator : `${estimate.numerator}/${estimate.denominator}`;
}

export function CenterScreen({ snapshot, loading, error, onRefresh }: { snapshot?: CenterSnapshotView; loading: boolean; error?: string; onRefresh(): void }) {
  if (loading) return createElement("main", { "aria-label": "Merkez" }, createElement("p", { role: "status" }, "Merkez verisi yükleniyor…"));
  if (error || !snapshot) return createElement("main", { "aria-label": "Merkez" }, createElement("h1", null, "Merkez"), createElement("p", { role: "status" }, error ?? "Merkez profili hazırlanmadı."), createElement("button", { onClick: onRefresh }, "Yenile"));
  return createElement(
    "main", { "aria-label": "Merkez" },
    createElement("h1", null, "Merkez"),
    createElement("button", { onClick: onRefresh }, "Veriyi yenile"),
    createElement("p", { role: "status" }, `Sunucu zamanı: ${snapshot.asOfMs}`),
    createElement("section", { "aria-labelledby": "resources" }, createElement("h2", { id: "resources" }, "Kaynaklar"), createElement("ul", null, snapshot.resources.map((resource) => createElement("li", { key: resource.kind }, `${resource.kind}: ${resource.balanceMicro} mikro-birim${resource.lastReason ? `; son neden: ${resource.lastReason}` : ""}`)))),
    createElement("section", { "aria-labelledby": "energy" }, createElement("h2", { id: "energy" }, "Enerji durumu"), createElement("p", { role: "status" }, `${snapshot.energy.status}: ${snapshot.energy.explanation}`), createElement("p", null, `Kullanılabilir ${snapshot.energy.availableMicroPerHour}; talep ${snapshot.energy.demandMicroPerHour} mikro-birim/saat.`)),
    createElement("section", { "aria-labelledby": "facilities" }, createElement("h2", { id: "facilities" }, "Tesis tahminleri"), createElement("ul", null, snapshot.facilities.map((facility) => createElement("li", { key: facility.id }, `${facility.kind} seviye ${facility.level}, öncelik ${facility.priority}: tahmin ${formatEstimate(facility.estimateMicroPerHour)} mikro-birim/saat`))))
  );
}

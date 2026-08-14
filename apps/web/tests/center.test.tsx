import { strict as assert } from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CenterScreen } from "@nexus/ui";
import type { CenterSnapshot } from "@nexus/contracts";

const snapshot: CenterSnapshot = {
  asOfMs: "1800000000000", contentVersion: "asteria-baseline-0.2", formulaVersion: "balance-1.2",
  resources: [{ kind: "energy", balanceMicro: "20", lastReason: "accrual_settlement" }, { kind: "compute", balanceMicro: "150000000" }],
  facilities: [{ id: "facility-1", kind: "data_center", level: 1, priority: 3, estimateMicroPerHour: { numerator: "15", denominator: "7" } }],
  energy: { status: "constrained", availableMicroPerHour: "20", demandMicroPerHour: "70000000", explanation: "Enerji kısıtlı; tahminler öncelik sırasına göre azaltıldı." },
};

const html = renderToStaticMarkup(<CenterScreen snapshot={snapshot} loading={false} onRefresh={() => undefined} />);
for (const text of ["Kaynaklar", "accrual_settlement", "Enerji durumu", "Enerji kısıtlı", "Tesis tahminleri", "15/7", "Veriyi yenile"]) assert.ok(html.includes(text), `Missing accessible center text: ${text}`);
assert.ok(html.includes('role="status"'));
const loading = renderToStaticMarkup(<CenterScreen loading={true} onRefresh={() => undefined} />);
assert.ok(loading.includes("Merkez verisi yükleniyor"));
const error = renderToStaticMarkup(<CenterScreen loading={false} error="Merkez profili hazırlanmadı." onRefresh={() => undefined} />);
assert.ok(error.includes("Yenile"));
console.log("PASS: center screen exposes accessible status, exact estimates, reasons, and recovery states.");

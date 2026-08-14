import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useState } from "react";
import { WEB_SHELL_TITLE } from "@nexus/contracts";
import type { CenterSnapshot } from "@nexus/contracts";
import { CenterScreen } from "@nexus/ui";

function CenterApp() {
  const [snapshot, setSnapshot] = useState<CenterSnapshot>(); const [loading, setLoading] = useState(true); const [error, setError] = useState<string>();
  const refresh = useCallback(async () => { setLoading(true); setError(undefined); try { const response = await fetch("/v1/center", { cache: "no-store" }); if (!response.ok) throw new Error("Merkez profili henüz sunucuda yapılandırılmadı."); setSnapshot(await response.json() as CenterSnapshot); } catch (cause) { setError(cause instanceof Error ? cause.message : "Merkez verisi alınamadı."); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]); return <CenterScreen {...(snapshot ? { snapshot } : {})} loading={loading} {...(error ? { error } : {})} onRefresh={() => void refresh()} />;
}

export function bootstrapWebShell(container: Element): void {
  document.title = WEB_SHELL_TITLE; createRoot(container).render(<CenterApp />);
}

const root = document.querySelector("#root");
if (root) bootstrapWebShell(root);

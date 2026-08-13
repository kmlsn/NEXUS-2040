import { createRoot } from "react-dom/client";
import { WEB_SHELL_TITLE } from "@nexus/contracts";
import { AppShell } from "@nexus/ui";

export function bootstrapWebShell(container: Element): void {
  createRoot(container).render(<AppShell title={WEB_SHELL_TITLE} />);
}

const root = document.querySelector("#root");
if (root) bootstrapWebShell(root);

import { createElement } from "react";

export interface AppShellProps {
  title: string;
}

export function AppShell({ title }: AppShellProps) {
  return createElement("main", { "aria-label": title }, createElement("h1", null, title));
}

import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function Settings() {
  return (
    <PageShell title="Settings">
      <SettingsForm />
    </PageShell>
  );
}

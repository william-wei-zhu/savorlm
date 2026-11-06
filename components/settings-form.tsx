"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card } from "./page-shell";

const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
] as const;

export function SettingsForm() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [voice, setVoice] = useState(true);

  useEffect(() => {
    // Client-only prefs: read once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      setVoice(localStorage.getItem("slm_voice") !== "0");
    } catch {}
  }, []);

  const pick = (v: boolean) => {
    setVoice(v);
    try {
      localStorage.setItem("slm_voice", v ? "1" : "0");
    } catch {}
  };

  return (
    <>
      <Card title="Theme">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={mounted && theme === t.id} onClick={() => setTheme(t.id)} className={`btn ${mounted && theme === t.id ? "btn-primary" : "btn-outline"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </Card>
      <Card title="Savvy's voice">
        <p>Savvy reads his lines out loud. Turn it off to read them instead.</p>
        <div className="flex gap-2" role="radiogroup" aria-label="Savvy's voice">
          <button type="button" role="radio" aria-checked={voice} onClick={() => pick(true)} className={`btn ${voice ? "btn-primary" : "btn-outline"}`}>
            Voice on
          </button>
          <button type="button" role="radio" aria-checked={!voice} onClick={() => pick(false)} className={`btn ${!voice ? "btn-primary" : "btn-outline"}`}>
            Voice off
          </button>
        </div>
      </Card>
    </>
  );
}

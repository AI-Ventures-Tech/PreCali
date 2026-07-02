"use client";

import type { TipoSeguro } from "@/data/tasas";

interface InsuranceTabsProps {
  tipo: TipoSeguro;
  setTipo: (t: TipoSeguro) => void;
}

const TABS: { value: TipoSeguro; label: string }[] = [
  { value: "auto", label: "Vehículo" },
  { value: "vida", label: "Vida" },
  { value: "salud", label: "Salud" },
];

/**
 * Puerto de las pestañas `.insurance-tab` (index.html:274-284, seguros.js:557-562).
 * Conserva la clase `active` y el `data-insurance-type` del legacy para que
 * styles.css siga aplicando.
 */
export default function InsuranceTabs({ tipo, setTipo }: InsuranceTabsProps) {
  return (
    <>
      <label className="tabs-label">Tipo de seguro</label>
      <div className="insurance-tabs" role="tablist" aria-label="Tipo de seguro">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`insurance-tab${t.value === tipo ? " active" : ""}`}
            data-insurance-type={t.value}
            onClick={() => setTipo(t.value)}
          >
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

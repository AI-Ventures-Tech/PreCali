"use client";

import { useCallback, useEffect, useState } from "react";
import { PAISES } from "@/data/paises";
import type { PaisId } from "@/types/precali";

interface CountrySelectProps {
  value?: PaisId;
  defaultValue?: PaisId;
  onChange?: (paisId: PaisId) => void;
  id?: string;
}

export default function CountrySelect({
  value,
  defaultValue = "cr",
  onChange,
  id = "pais",
}: CountrySelectProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<PaisId>(defaultValue);
  const selected: PaisId = isControlled ? value : internal;

  const flag =
    PAISES.find((p) => p.id === selected)?.bandera ?? PAISES[0].bandera;

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value as PaisId;
      if (!isControlled) setInternal(next);
      onChange?.(next);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent<PaisId>("precali:country", { detail: next }),
        );
      }
    },
    [isControlled, onChange],
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.pais = selected;
    }
  }, [selected]);

  return (
    <label className="country-select-wrap" aria-label="Seleccionar país">
      <span className="country-label">País</span>
      <span id="pais-bandera" className="country-flag" aria-hidden="true">
        {flag}
      </span>
      <select
        id={id}
        className="country-select"
        value={selected}
        onChange={handleChange}
      >
        {PAISES.map((pais) => (
          <option key={pais.id} value={pais.id}>
            {pais.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

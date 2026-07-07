"use client";

import type { Pais, TipoPrestamo } from "@/types/precali";
import { CONFIG_TIPOS } from "@/data/config";
import type { Moneda } from "@/hooks/calc";
import type { CalculadoraInputs } from "@/hooks/use-calculadora-credito";
import { describirMonto, fmt } from "@/lib/format";

interface CalculatorFormProps {
  tipoActual: TipoPrestamo;
  setTipo: (t: TipoPrestamo) => void;
  inputs: CalculadoraInputs;
  setInputs: (p: Partial<CalculadoraInputs>) => void;
  rangos: {
    ingreso: { min: number; max: number; step: number };
    deudas: { min: number; max: number; step: number };
    prima: { min: number; max: number; step: number };
  };
  plazoMax: number;
  pais: Pais;
}

/**
 * Puerto del formulario `.form-card` (index.html:155-201) + tabs de tipo
 * (index.html:143-153). Conserva las clases legacy para que styles.css aplique.
 */
export default function CalculatorForm({
  tipoActual,
  setTipo,
  inputs,
  setInputs,
  rangos,
  plazoMax,
  pais,
}: CalculatorFormProps) {
  const cfg = CONFIG_TIPOS[tipoActual];
  const moneda = inputs.moneda;
  const plazoMin = cfg.plazoMin;
  const plazoEfectivo = Math.min(inputs.plazo, plazoMax);

  return (
    <>
      <label className="tabs-label">Tipo de préstamo</label>
      <div className="loan-tabs">
        {(["personal", "vehiculo", "hipoteca"] as const).map((t) => (
          <button
            key={t}
            className={`loan-tab${t === tipoActual ? " active" : ""}`}
            onClick={() => setTipo(t)}
            type="button"
          >
            <span className="tab-label">
              {t === "personal" ? "Personal" : t === "vehiculo" ? "Vehículo" : "Hipoteca"}
            </span>
          </button>
        ))}
      </div>

      <div className="card form-card">
        <div className="form-grid">
          <div className="field">
            <div className="field-header">
              <label>Ingreso mensual neto</label>
              <span className="field-value">{fmt(inputs.ingreso, moneda, pais)}</span>
            </div>
            <input
              type="number"
              className="input-text amount-input"
              min={rangos.ingreso.min}
              max={rangos.ingreso.max}
              step={rangos.ingreso.step}
              value={inputs.ingreso}
              inputMode="numeric"
              onChange={(e) => setInputs({ ingreso: Number(e.target.value) || 0 })}
            />
            <div className="field-hint amount-helper">
              {describirMonto(inputs.ingreso, moneda, pais)}
            </div>
          </div>

          <div className="field">
            <div className="field-header">
              <label>Deudas mensuales</label>
              <span className="field-value">{fmt(inputs.deudas, moneda, pais)}</span>
            </div>
            <input
              type="number"
              className="input-text amount-input"
              min={rangos.deudas.min}
              max={rangos.deudas.max}
              step={rangos.deudas.step}
              value={inputs.deudas}
              inputMode="numeric"
              onChange={(e) => setInputs({ deudas: Number(e.target.value) || 0 })}
            />
            <div className="field-hint amount-helper">
              {describirMonto(inputs.deudas, moneda, pais)}
            </div>
          </div>

          <div className="field">
            <div className="field-header">
              <label>Plazo deseado</label>
              <span className="field-value">
                {plazoEfectivo}
                {plazoEfectivo === 1 ? " año" : " años"}
              </span>
            </div>
            <input
              type="range"
              min={plazoMin}
              max={plazoMax}
              step={1}
              value={plazoEfectivo}
              onChange={(e) => setInputs({ plazo: Number(e.target.value) })}
            />
            <div className="field-hint">
              {`Plazo máximo según bancos seleccionados: ${plazoMax} años`}
            </div>
          </div>

          <div className="field">
            <label className="field-label-block">Moneda</label>
            <select
              className="select"
              value={moneda}
              onChange={(e) => setInputs({ moneda: e.target.value as Moneda })}
            >
              <option value="crc">
                {pais.moneda} ({pais.simbolo})
              </option>
              <option value="usd">Dólares ($)</option>
            </select>
          </div>

          {cfg.prima && (
            <div className="field field-full">
              <div className="field-header">
                <label>Prima / enganche disponible</label>
                <span className="field-value">{fmt(inputs.prima, moneda, pais)}</span>
              </div>
              <input
                type="number"
                className="input-text amount-input"
                min={rangos.prima.min}
                max={rangos.prima.max}
                step={rangos.prima.step}
                value={inputs.prima}
                inputMode="numeric"
                onChange={(e) => setInputs({ prima: Number(e.target.value) || 0 })}
              />
              <div className="field-hint amount-helper">
                {describirMonto(inputs.prima, moneda, pais)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

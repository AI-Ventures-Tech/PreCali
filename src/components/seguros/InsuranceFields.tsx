"use client";

import type { Pais } from "@/types/precali";
import {
  COBERTURA_OPTIONS,
  DEDUCIBLE_OPTIONS,
  FUMADOR_OPTIONS,
  MODALIDAD_OPTIONS,
  PLAN_SALUD_OPTIONS,
  PLAZO_VIDA_OPTIONS,
  RED_OPTIONS,
  USO_OPTIONS,
  ZONA_OPTIONS,
  type TipoSeguro,
} from "@/data/tasas";
import type {
  InputsSeguro,
} from "@/hooks/use-comparador-seguros";
import { fmtSeguro, usdFmt } from "@/hooks/use-comparador-seguros";

interface InsuranceFieldsProps {
  tipo: TipoSeguro;
  inputs: InputsSeguro;
  setInputs: <K extends TipoSeguro>(tipo: K, patch: Partial<InputsSeguro[K]>) => void;
  pais: Pais;
  /** Año de referencia para el `max` del campo año (legacy = YEAR + 1). */
  year: number;
}

/**
 * Puerto del formulario `#insurance-form` (index.html:286-370) y de
 * `renderLabels` (seguros.js:283-293). Conserva los IDs legacy
 * (`#ins-auto-*`, `#ins-vida-*`, `#ins-salud-*`), los `data-insurance-fields`
 * y las clases `.field` / `.field-header` para que styles.css aplique sin
 * cambios. Las etiquetas laterales se actualizan en vivo con el valor
 * controlado, igual que en el legacy.
 */
export default function InsuranceFields({
  tipo,
  inputs,
  setInputs,
  pais,
  year,
}: InsuranceFieldsProps) {
  return (
    <form id="insurance-form" className="insurance-form" autoComplete="off">
      {/* ───────── Auto ───────── */}
      <div
        className="form-grid insurance-fields"
        data-insurance-fields="auto"
        hidden={tipo !== "auto"}
      >
        <div className="field">
          <div className="field-header">
            <label htmlFor="ins-auto-valor">Valor del vehículo</label>
            <span className="field-value" id="ins-auto-valor-label">
              {fmtSeguro(inputs.auto.valor, pais)}
            </span>
          </div>
          <input
            type="number"
            id="ins-auto-valor"
            className="input-text"
            min={1000}
            step={1000}
            value={inputs.auto.valor}
            onChange={(e) => setInputs("auto", { valor: Number(e.target.value) || 0 })}
          />
          <div className="field-hint">Valor de mercado o precio aproximado del vehículo.</div>
        </div>

        <div className="field">
          <div className="field-header">
            <label htmlFor="ins-auto-anio">Año</label>
            <span className="field-value" id="ins-auto-anio-label">
              {inputs.auto.anio || year}
            </span>
          </div>
          <input
            type="number"
            id="ins-auto-anio"
            className="input-text"
            min={1990}
            max={year + 1}
            step={1}
            value={inputs.auto.anio}
            onChange={(e) => setInputs("auto", { anio: Number(e.target.value) || 0 })}
          />
          <div className="field-hint">La antigüedad ajusta el rango estimado.</div>
        </div>

        <div className="field">
          <label className="field-label-block" htmlFor="ins-auto-cobertura">
            Cobertura
          </label>
          <select
            id="ins-auto-cobertura"
            className="select"
            value={inputs.auto.cobertura}
            onChange={(e) =>
              setInputs("auto", {
                cobertura: e.target.value as InputsSeguro["auto"]["cobertura"],
              })
            }
          >
            {COBERTURA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label-block" htmlFor="ins-auto-uso">
            Uso
          </label>
          <select
            id="ins-auto-uso"
            className="select"
            value={inputs.auto.uso}
            onChange={(e) =>
              setInputs("auto", { uso: e.target.value as InputsSeguro["auto"]["uso"] })
            }
          >
            {USO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label-block" htmlFor="ins-auto-zona">
            Zona
          </label>
          <select
            id="ins-auto-zona"
            className="select"
            value={inputs.auto.zona}
            onChange={(e) =>
              setInputs("auto", { zona: e.target.value as InputsSeguro["auto"]["zona"] })
            }
          >
            {ZONA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="field-header">
            <label htmlFor="ins-auto-edad">Edad del conductor</label>
            <span className="field-value" id="ins-auto-edad-label">
              {inputs.auto.edad || 35} años
            </span>
          </div>
          <input
            type="number"
            id="ins-auto-edad"
            className="input-text"
            min={18}
            max={85}
            step={1}
            value={inputs.auto.edad}
            onChange={(e) => setInputs("auto", { edad: Number(e.target.value) || 0 })}
          />
        </div>
      </div>

      {/* ───────── Vida ───────── */}
      <div
        className="form-grid insurance-fields"
        data-insurance-fields="vida"
        hidden={tipo !== "vida"}
      >
        <div className="field">
          <div className="field-header">
            <label htmlFor="ins-vida-edad">Edad del asegurado</label>
            <span className="field-value" id="ins-vida-edad-label">
              {inputs.vida.edad || 35} años
            </span>
          </div>
          <input
            type="number"
            id="ins-vida-edad"
            className="input-text"
            min={18}
            max={75}
            step={1}
            value={inputs.vida.edad}
            onChange={(e) => setInputs("vida", { edad: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="field">
          <div className="field-header">
            <label htmlFor="ins-vida-suma">Suma asegurada</label>
            <span className="field-value" id="ins-vida-suma-label">
              {usdFmt(inputs.vida.suma)}
            </span>
          </div>
          <input
            type="number"
            id="ins-vida-suma"
            className="input-text"
            min={5000}
            step={5000}
            value={inputs.vida.suma}
            onChange={(e) => setInputs("vida", { suma: Number(e.target.value) || 0 })}
          />
          <div className="field-hint">Ingresá el monto en dólares o equivalente.</div>
        </div>

        <div className="field">
          <label className="field-label-block" htmlFor="ins-vida-fumador">
            Fumador
          </label>
          <select
            id="ins-vida-fumador"
            className="select"
            value={inputs.vida.fumador}
            onChange={(e) =>
              setInputs("vida", {
                fumador: e.target.value as InputsSeguro["vida"]["fumador"],
              })
            }
          >
            {FUMADOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label-block" htmlFor="ins-vida-plazo">
            Plazo
          </label>
          <select
            id="ins-vida-plazo"
            className="select"
            value={inputs.vida.plazo}
            onChange={(e) => setInputs("vida", { plazo: Number(e.target.value) || 0 })}
          >
            {PLAZO_VIDA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ───────── Salud ───────── */}
      <div
        className="form-grid insurance-fields"
        data-insurance-fields="salud"
        hidden={tipo !== "salud"}
      >
        <div className="field">
          <div className="field-header">
            <label htmlFor="ins-salud-edad">Edad del asegurado</label>
            <span className="field-value" id="ins-salud-edad-label">
              {inputs.salud.edad || 35} años
            </span>
          </div>
          <input
            type="number"
            id="ins-salud-edad"
            className="input-text"
            min={0}
            max={80}
            step={1}
            value={inputs.salud.edad}
            onChange={(e) => setInputs("salud", { edad: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="field">
          <label className="field-label-block" htmlFor="ins-salud-plan">
            Nivel del plan
          </label>
          <select
            id="ins-salud-plan"
            className="select"
            value={inputs.salud.plan}
            onChange={(e) =>
              setInputs("salud", { plan: e.target.value as InputsSeguro["salud"]["plan"] })
            }
          >
            {PLAN_SALUD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label-block" htmlFor="ins-salud-deducible">
            Deducible preferido
          </label>
          <select
            id="ins-salud-deducible"
            className="select"
            value={inputs.salud.deducible}
            onChange={(e) =>
              setInputs("salud", {
                deducible: e.target.value as InputsSeguro["salud"]["deducible"],
              })
            }
          >
            {DEDUCIBLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label-block" htmlFor="ins-salud-modalidad">
            Modalidad
          </label>
          <select
            id="ins-salud-modalidad"
            className="select"
            value={inputs.salud.modalidad}
            onChange={(e) =>
              setInputs("salud", {
                modalidad: e.target.value as InputsSeguro["salud"]["modalidad"],
              })
            }
          >
            {MODALIDAD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-full">
          <label className="field-label-block" htmlFor="ins-salud-red">
            Red médica
          </label>
          <select
            id="ins-salud-red"
            className="select"
            value={inputs.salud.red}
            onChange={(e) =>
              setInputs("salud", { red: e.target.value as InputsSeguro["salud"]["red"] })
            }
          >
            {RED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
}

"use client";

import type { Pais } from "@/types/precali";
import type { OrdenSeguro } from "@/data/tasas";
import {
  fmtSeguro,
  rangeLabelSeguro,
  type ResultadoSeguro,
} from "@/hooks/use-comparador-seguros";

interface InsuranceResultListProps {
  resultados: ResultadoSeguro[];
  orden: OrdenSeguro;
  setOrden: (o: OrdenSeguro) => void;
  pais: Pais;
  onVerDetalle: (r: ResultadoSeguro) => void;
  onAbrirEmail: (r: ResultadoSeguro) => void;
}

/**
 * Puerto del bloque de resultados `#insurance-results` + `#insurance-sort`
 * (seguros.js:295-366). Conserva las clases `.insurance-results-head`,
 * `.insurance-results` y `.bank-card` para que styles.css aplique. Replica el
 * badge "Mejor opción" (menor prima mensual) y el "mejor rating" del legacy.
 */
export default function InsuranceResultList({
  resultados,
  orden,
  setOrden,
  pais,
  onVerDetalle,
  onAbrirEmail,
}: InsuranceResultListProps) {
  const bestPrice =
    resultados.length > 0
      ? Math.min(...resultados.map((r) => r.monthlyMin))
      : 0;
  const bestRating =
    resultados.length > 0
      ? Math.max(...resultados.map((r) => r.aseguradora.rating || 0))
      : 0;

  return (
    <>
      <div className="insurance-results-head">
        <div>
          <div className="section-eyebrow">Resultados</div>
          <h3>Opciones estimadas para tu perfil</h3>
        </div>
        <select
          id="insurance-sort"
          className="select select-sm"
          aria-label="Ordenar seguros"
          value={orden}
          onChange={(e) => setOrden(e.target.value as OrdenSeguro)}
        >
          <option value="precio">Menor prima estimada</option>
          <option value="rating">Mejor rating / fortaleza</option>
        </select>
      </div>

      <div id="insurance-results" className="insurance-results">
        {resultados.length === 0 ? (
          <EmptyResults pais={pais} />
        ) : (
          resultados.map((r, idx) => (
            <InsuranceResultCard
              key={r.aseguradora.id}
              r={r}
              index={idx}
              isBestPrice={r.monthlyMin === bestPrice}
              isBestRating={(r.aseguradora.rating || 0) === bestRating}
              pais={pais}
              onVerDetalle={onVerDetalle}
              onAbrirEmail={onAbrirEmail}
            />
          ))
        )}
      </div>
    </>
  );
}

/** Puerto de la tarjeta `.bank-card` calificante (seguros.js:323-365). */
function InsuranceResultCard({
  r,
  index,
  isBestPrice,
  isBestRating,
  pais,
  onVerDetalle,
  onAbrirEmail,
}: {
  r: ResultadoSeguro;
  index: number;
  isBestPrice: boolean;
  isBestRating: boolean;
  pais: Pais;
  onVerDetalle: (r: ResultadoSeguro) => void;
  onAbrirEmail: (r: ResultadoSeguro) => void;
}) {
  return (
    <div
      className={`bank-card${isBestPrice ? " best" : ""}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {isBestPrice && <span className="best-badge">Mejor opción</span>}
      <div className="bank-card-header">
        <div className="bank-card-info">
          <div className="bank-logo" style={{ background: r.aseguradora.color }}>
            {r.aseguradora.iniciales}
          </div>
          <div className="bank-card-info-text">
            <div className="bank-card-name">{r.aseguradora.nombre}</div>
            <div className="bank-card-meta">
              {r.aseguradora.tipo} · {r.meta.productoLabel} · {r.meta.precision}{" "}
              precisión
              {isBestRating ? " · mejor rating" : ""}
            </div>
          </div>
        </div>
        <div className="bank-card-actions">
          <span className="status-ok">✓ Estimado</span>
          <button className="btn-detail" type="button" onClick={() => onVerDetalle(r)}>
            Ver detalles
          </button>
          <button className="btn-email" type="button" onClick={() => onAbrirEmail(r)}>
            Envíenmelo por email
          </button>
        </div>
      </div>
      <div className="bank-metrics">
        <div className="metric">
          <span className="metric-label">Prima estimada</span>
          <span className="metric-value">{rangeLabelSeguro(r, pais)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Desde</span>
          <span className="metric-value">{fmtSeguro(r.monthlyMin, pais)} / mes</span>
        </div>
        <div className="metric">
          <span className="metric-label">Frecuencia</span>
          <span className="metric-value">
            {r.meta.frecuencia === "mensual" ? "Mensual" : "Anual"}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Perfil</span>
          <span className="metric-value">{r.meta.resumenCorto}</span>
        </div>
      </div>
    </div>
  );
}

/** Puerto del estado vacío `.market-pending-card` (seguros.js:306-317). */
function EmptyResults({ pais }: { pais: Pais }) {
  return (
    <div className="market-pending-card">
      <div className="market-pending-flag">{pais.bandera || ""}</div>
      <div>
        <strong>No hay aseguradoras cargadas para este producto</strong>
        <p>
          Estamos validando fuentes y cotizadores oficiales para {pais.nombre}.
          Probá con otro tipo de seguro o país.
        </p>
      </div>
    </div>
  );
}

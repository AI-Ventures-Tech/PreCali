"use client";

import type { Pais, TipoPrestamo } from "@/types/precali";
import { CONFIG_TIPOS } from "@/data/config";
import type { Moneda, ResultadoBanco } from "@/hooks/calc";
import {
  describirFallaPrincipal,
  etiquetaCalidadDato,
  fmt,
} from "@/lib/format";

interface ResultCardProps {
  r: ResultadoBanco;
  index: number;
  tipoActual: TipoPrestamo;
  moneda: Moneda;
  pais: Pais;
  onVerDetalle: (r: ResultadoBanco) => void;
  onAbrirEmail: (r: ResultadoBanco) => void;
}

/** Puerto del `.bank-card` calificante (app.js:1117-1141). */
export default function ResultCard({
  r,
  index,
  tipoActual,
  moneda,
  pais,
  onVerDetalle,
  onAbrirEmail,
}: ResultCardProps) {
  const cfg = CONFIG_TIPOS[tipoActual];
  const isBest = index === 0;
  const labelMonto = cfg.prima
    ? tipoActual === "hipoteca"
      ? "Valor máx. propiedad"
      : "Valor máx. vehículo"
    : "Monto pre-aprobado";
  const valorMostrar = cfg.prima ? r.valorBien ?? 0 : r.monto;
  const ratioPct = Math.round(r.ratio * 100);
  const ajuste =
    r.plazoEfectivo < r.plazoSolicitado ? (
      <>
        {" "}
        <span className="warn">(ajustado de {r.plazoSolicitado})</span>
      </>
    ) : null;

  return (
    <div
      className={`bank-card${isBest ? " best" : ""}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {isBest && <span className="best-badge">Mejor opción</span>}
      <div className="bank-card-header">
        <div className="bank-card-info">
          <div
            className="bank-logo"
            style={{ background: r.banco.color }}
          >
            {r.banco.iniciales}
          </div>
          <div className="bank-card-info-text">
            <div className="bank-card-name">{r.banco.nombre}</div>
            <div className="bank-card-meta">
              {r.tasa.toFixed(2)}% · {r.plazoEfectivo} años{ajuste} · {ratioPct}%
              capacidad{etiquetaCalidadDato(r.banco)}
            </div>
          </div>
        </div>
        <div className="bank-card-actions">
          <span className="status-ok">✓ Califica</span>
          <button className="btn-detail" onClick={() => onVerDetalle(r)}>
            Ver detalles
          </button>
          <button className="btn-email" onClick={() => onAbrirEmail(r)}>
            Envíenmelo por email
          </button>
        </div>
      </div>
      <div className="bank-metrics">
        <div className="metric">
          <span className="metric-label">{labelMonto}</span>
          <span className="metric-value">{fmt(valorMostrar, moneda, pais)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Cuota mensual</span>
          <span className="metric-value">{fmt(r.cuota, moneda, pais)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Total a pagar</span>
          <span className="metric-value">{fmt(r.total, moneda, pais)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Total intereses</span>
          <span className="metric-value">{fmt(r.intereses, moneda, pais)}</span>
        </div>
      </div>
    </div>
  );
}

interface NotQualifiedCardProps {
  r: ResultadoBanco;
  moneda: Moneda;
  pais: Pais;
}

/** Puerto del `.bank-card.bank-card-muted` no calificante (app.js:1089-1101). */
export function NotQualifiedCard({ r, moneda, pais }: NotQualifiedCardProps) {
  return (
    <div className="bank-card bank-card-muted">
      <div className="bank-card-header">
        <div className="bank-card-info">
          <div
            className="bank-logo"
            style={{ background: r.banco.color }}
          >
            {r.banco.iniciales}
          </div>
          <div className="bank-card-info-text">
            <div className="bank-card-name">{r.banco.nombre}</div>
            <div className="bank-card-meta">
              {describirFallaPrincipal(r.fallas[0], moneda, pais)}
            </div>
          </div>
        </div>
        <span className="status-no">No califica</span>
      </div>
    </div>
  );
}

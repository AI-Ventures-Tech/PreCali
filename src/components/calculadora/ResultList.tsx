"use client";

import type { ReactNode } from "react";
import type { Pais, TipoPrestamo } from "@/types/precali";
import type { Moneda, Orden, ResultadoBanco } from "@/hooks/calc";
import ResultCard, { NotQualifiedCard } from "@/components/calculadora/ResultCard";
import { fmt } from "@/lib/format";

interface ResultListProps {
  resultados: ResultadoBanco[];
  noCalifican: ResultadoBanco[];
  orden: Orden;
  onOrdenChange: (orden: Orden) => void;
  tipoActual: TipoPrestamo;
  moneda: Moneda;
  pais: Pais;
  /** Escalares del formulario, para `generarBarrerasGlobales` (app.js:495). */
  ingreso: number;
  deudas: number;
  prima: number;
  onVerDetalle: (r: ResultadoBanco) => void;
  onAbrirEmail: (r: ResultadoBanco) => void;
}

/**
 * Puerto del bloque de resultados de `calcular()` (app.js:1027-1142):
 * estado vacío (sin bancos), tarjeta de no-calificados con barreras globales,
 * tarjetas calificantes y la sección "donde todavía no calificás".
 */
export default function ResultList({
  resultados,
  noCalifican,
  orden,
  onOrdenChange,
  tipoActual,
  moneda,
  pais,
  ingreso,
  deudas,
  prima,
  onVerDetalle,
  onAbrirEmail,
}: ResultListProps) {
  return (
    <>
      <div className="section-eyebrow" style={{ marginTop: "2.5rem" }}>
        Comparativa de créditos
      </div>
      <div className="results-header">
        <h2 className="section-title">Resultados</h2>
        <select
          className="select select-sm"
          value={orden}
          onChange={(e) => onOrdenChange(e.target.value as Orden)}
        >
          <option value="cuota">Ordenar por cuota más baja</option>
          <option value="tasa">Ordenar por menor tasa</option>
          <option value="monto">Ordenar por mayor monto</option>
          <option value="total">Ordenar por menor total</option>
        </select>
      </div>

      <div id="results">
        {resultados.length === 0 ? (
          <NoQualified
            noCalifican={noCalifican}
            ingreso={ingreso}
            deudas={deudas}
            prima={prima}
            tipoActual={tipoActual}
            moneda={moneda}
            pais={pais}
          />
        ) : (
          <>
            {resultados.map((r, idx) => (
              <ResultCard
                key={r.banco.id}
                r={r}
                index={idx}
                tipoActual={tipoActual}
                moneda={moneda}
                pais={pais}
                onVerDetalle={onVerDetalle}
                onAbrirEmail={onAbrirEmail}
              />
            ))}
            {noCalifican.length > 0 && (
              <div className="not-qualified-section">
                <div className="not-qualified-title">
                  Bancos donde todavía no calificás
                </div>
                <div className="not-qualified-grid">
                  {noCalifican.map((r) => (
                    <NotQualifiedCard
                      key={r.banco.id}
                      r={r}
                      moneda={moneda}
                      pais={pais}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function NoQualified({
  noCalifican,
  ingreso,
  deudas,
  prima,
  tipoActual,
  moneda,
  pais,
}: {
  noCalifican: ResultadoBanco[];
  ingreso: number;
  deudas: number;
  prima: number;
  tipoActual: TipoPrestamo;
  moneda: Moneda;
  pais: Pais;
}) {
  if (noCalifican.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem 1rem",
          color: "var(--ink-muted)",
          fontSize: 14,
          background: "var(--paper)",
          borderRadius: "var(--r-xl)",
          border: "1px dashed rgba(26,26,23,0.1)",
        }}
      >
        Seleccioná al menos un banco para ver los resultados
      </div>
    );
  }

  const requierePrima =
    tipoActual === "vehiculo" || tipoActual === "hipoteca";
  const barreras = generarBarrerasGlobales(
    noCalifican,
    ingreso,
    deudas,
    prima,
    requierePrima,
    tipoActual,
    moneda,
    pais,
  );

  return (
    <div className="no-calif-card">
      <div className="no-calif-header">
        <div className="no-calif-icon">⚠</div>
        <div>
          <div className="no-calif-title">
            Aún no calificás en{" "}
            {noCalifican.length === 1
              ? "el banco evaluado"
              : `los ${noCalifican.length} bancos seleccionados`}
          </div>
          <div className="no-calif-sub">
            Detectamos las barreras específicas que te impiden calificar y te
            sugerimos cómo ajustarlas para volver a intentarlo.
          </div>
        </div>
      </div>
      <div className="barrier-list">
        {barreras.map((b) => (
          <div className="barrier-item" key={b.titulo}>
            <div className="barrier-title">{b.titulo}</div>
            <div className="barrier-desc">{b.descripcion}</div>
            <div className="barrier-action">{b.accion}</div>
          </div>
        ))}
      </div>
      <div className="no-calif-foot">
        <strong>Recordá:</strong> esto es una estimación con criterios públicos.
        Algunos bancos pueden flexibilizar requisitos según tu historial CIC,
        antigüedad laboral, o si tenés productos vigentes con ellos. Te
        recomendamos contactar directamente al banco para una evaluación
        personalizada.
      </div>
    </div>
  );
}

interface Barrera {
  titulo: string;
  descripcion: ReactNode;
  accion: string;
}

/** Puerto verbatim de `generarBarrerasGlobales` (app.js:495-542). */
function generarBarrerasGlobales(
  resultados: ResultadoBanco[],
  ingreso: number,
  deudas: number,
  prima: number,
  requierePrima: boolean,
  tipoActual: TipoPrestamo,
  moneda: Moneda,
  pais: Pais,
): Barrera[] {
  const barreras: Barrera[] = [];
  const f = (v: number) => fmt(v, moneda, pais);

  if (resultados.every((r) => ingreso < r.ingresoMinConvertido)) {
    const ingresoMin = Math.min(...resultados.map((r) => r.ingresoMinConvertido));
    const bancoMin = resultados.find(
      (r) => r.ingresoMinConvertido === ingresoMin,
    )!.banco;
    const faltante = ingresoMin - ingreso;
    barreras.push({
      titulo: "Tu ingreso está por debajo del mínimo",
      descripcion: (
        <>
          El banco con menor ingreso requerido es <strong>{bancoMin.nombre}</strong>, que pide al
          menos <strong>{f(ingresoMin)}</strong> mensuales. Te faltan <strong>{f(faltante)}</strong>{" "}
          para alcanzar ese piso.
        </>
      ),
      accion: "Considera incluir un codeudor, sumar ingresos del cónyuge, o esperar a aumentar tus ingresos.",
    });
  }

  if (resultados.every((r) => r.fallas.some((x) => x.tipo === "deuda"))) {
    const ratioMaxBanco = Math.max(...resultados.map((r) => r.params.ratioMax));
    const bancoFlexible = resultados.find(
      (r) => r.params.ratioMax === ratioMaxBanco,
    )!.banco;
    const deudaPermitida = ingreso * ratioMaxBanco;
    const exceso = deudas - deudaPermitida;
    const ratioActual =
      ingreso > 0 ? ((deudas / ingreso) * 100).toFixed(0) : "0";
    barreras.push({
      titulo: "Tus deudas consumen toda tu capacidad de pago",
      descripcion: (
        <>
          Hoy destinás aproximadamente <strong>{ratioActual}%</strong> de tu ingreso a deudas. El
          banco más permisivo, <strong>{bancoFlexible.nombre}</strong>, acepta hasta{" "}
          <strong>{Math.round(ratioMaxBanco * 100)}%</strong>. Estás{" "}
          <strong>{f(Math.max(0, exceso))}</strong> por encima de ese límite mensual.
        </>
      ),
      accion: "Considerá consolidar deudas existentes, cancelar tarjetas de crédito antes de aplicar, o reducir el monto que solicitás.",
    });
  }

  if (
    requierePrima &&
    (prima <= 0 || resultados.every((r) => r.fallas.some((x) => x.tipo === "sinPrima")))
  ) {
    const financias = resultados.map((r) => r.params.financia ?? 0);
    const minFinancia = Math.max(...financias);
    const bancoFinancia = resultados.find(
      (r) => (r.params.financia ?? 0) === minFinancia,
    )!.banco;
    const primaMinimaPct = ((1 - minFinancia) * 100).toFixed(0);
    barreras.push({
      titulo:
        tipoActual === "hipoteca"
          ? "No has indicado prima para la propiedad"
          : "No has indicado prima para el vehículo",
      descripcion: (
        <>
          Para {tipoActual === "hipoteca" ? "una hipoteca" : "un préstamo vehicular"}, todos los
          bancos requieren al menos un porcentaje del valor del bien como prima.{" "}
          <strong>{bancoFinancia.nombre}</strong> es el más flexible, financiando hasta{" "}
          <strong>{Math.round(minFinancia * 100)}%</strong>, lo que requiere una prima mínima del{" "}
          <strong>{primaMinimaPct}%</strong>.
        </>
      ),
      accion: "Ajustá la prima al monto que tenés disponible para ahorrar o invertir como cuota inicial.",
    });
  }

  if (resultados.every((r) => r.fallas.some((x) => x.tipo === "montoMin"))) {
    const montoMin = Math.min(...resultados.map((r) => r.montoMinConvertido));
    const bancoMontoMin = resultados.find(
      (r) => r.montoMinConvertido === montoMin,
    )!.banco;
    barreras.push({
      titulo: "El monto que podrías obtener es muy bajo",
      descripcion: (
        <>
          Con tu capacidad de pago actual, los bancos calcularían un préstamo menor al monto mínimo
          que financian. <strong>{bancoMontoMin.nombre}</strong> es el que tiene el piso más bajo:{" "}
          <strong>{f(montoMin)}</strong>.
        </>
      ),
      accion: "Aumentá el plazo deseado para incrementar el monto financiable, o considerá reducir tus deudas mensuales actuales.",
    });
  }

  return barreras;
}

"use client";

import { useEffect, useState } from "react";
import { BANCOS } from "@/data/bancos";
import { AVISOS_LEGALES } from "@/data/avisos";
import { useCalculadoraCredito } from "@/hooks/use-calculadora-credito";
import type { ResultadoBanco } from "@/hooks/calc";
import CalculatorForm from "@/components/calculadora/CalculatorForm";
import ResultList from "@/components/calculadora/ResultList";
import {
  BankDetailModal,
  EmailLeadModal,
  LeadSuccessModal,
} from "@/components/calculadora/BankDetailModal";

/**
 * Sección principal `#calculadora`. Conecta el hook de cálculo con el
 * formulario, la lista de bancos, los resultados y los modales locales
 * (detalle / email / confirmación).
 *
 * Conserva las clases y la estructura del legacy (index.html:136-258) para que
 * styles.css siga aplicando sin cambios.
 */
export default function CalculadoraCreditos() {
  const calc = useCalculadoraCredito();
  const {
    pais,
    seleccion,
    toggleBanco,
    selectAll,
    tipoActual,
    setTipo,
    inputs,
    setInputs,
    rangos,
    plazoMax,
    resultados,
    noCalifican,
  } = calc;

  const bancos = BANCOS; // los datos tipados solo incluyen CR por ahora
  const aviso = AVISOS_LEGALES[pais.id] ?? AVISOS_LEGALES.cr;

  const [detalle, setDetalle] = useState<ResultadoBanco | null>(null);
  const [emailBanco, setEmailBanco] = useState<ResultadoBanco | null>(null);
  const [exito, setExito] = useState<{
    nombre: string;
    email: string;
    r: ResultadoBanco;
  } | null>(null);

  // Bloquea el scroll del fondo mientras hay un modal abierto (legacy body.style.overflow).
  useEffect(() => {
    const abierto = detalle || emailBanco || exito;
    document.body.style.overflow = abierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [detalle, emailBanco, exito]);

  // Cerrar con Escape (legacy keydown listener).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDetalle(null);
        setEmailBanco(null);
        setExito(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section id="calculadora" className="calculator-section">
      <div className="container">
        <div className="section-eyebrow">Créditos</div>
        <h2 className="section-title">Tu situación financiera</h2>
        <p className="section-sub">
          Ajustá los controles según tu realidad actual. Todo lo que ingresás se
          procesa localmente, no se almacena.
        </p>

        <CalculatorForm
          tipoActual={tipoActual}
          setTipo={setTipo}
          inputs={inputs}
          setInputs={setInputs}
          rangos={rangos}
          plazoMax={plazoMax}
          pais={pais}
        />

        <div id="bancos" className="anchor-scroll" />
        <div className="section-eyebrow" style={{ marginTop: "2.5rem" }}>
          Entidades financieras
        </div>
        <h2 className="section-title">Bancos a comparar</h2>
        <p className="section-sub">
          Seleccioná las entidades que te interesan. Cada banco tiene su propia
          política de tasa, plazo y capacidad de pago.
        </p>

        <div className="card banks-card">
          <div className="banks-header">
            <span className="banks-counter">
              <span>{seleccion.size}</span> de <span>{bancos.length}</span>{" "}
              seleccionados
            </span>
            <div className="banks-actions">
              <button className="btn-ghost" onClick={() => selectAll(true)} type="button">
                Todos
              </button>
              <button className="btn-ghost" onClick={() => selectAll(false)} type="button">
                Limpiar
              </button>
            </div>
          </div>
          <div className="banks-grid">
            {bancos.map((b) => (
              <label
                key={b.id}
                className={`bank-chip${seleccion.has(b.id) ? " selected" : ""}`}
                data-id={b.id}
              >
                <input
                  type="checkbox"
                  checked={seleccion.has(b.id)}
                  onChange={() => toggleBanco(b.id)}
                />
                <div className="bank-logo" style={{ background: b.color }}>
                  {b.iniciales}
                </div>
                <span className="bank-name">{b.nombre}</span>
              </label>
            ))}
          </div>
        </div>

        <ResultList
          resultados={resultados}
          noCalifican={noCalifican}
          orden={inputs.orden}
          onOrdenChange={(orden) => setInputs({ orden })}
          tipoActual={tipoActual}
          moneda={inputs.moneda}
          pais={pais}
          ingreso={inputs.ingreso}
          deudas={inputs.deudas}
          prima={inputs.prima}
          onVerDetalle={(r) => setDetalle(r)}
          onAbrirEmail={(r) => setEmailBanco(r)}
        />

        {aviso && (
          <div className="disclaimer-box">
            <strong>Aviso legal ({pais.nombre}):</strong> {aviso.creditos}{" "}
            {aviso.privacidad ?? ""} Esta herramienta es informativa y no constituye
            oferta vinculante. Al usar PreCali aceptás los{" "}
            <a href="/terminos.html">Términos y Condiciones</a> y la{" "}
            <a href="/privacidad.html">Política de Privacidad</a>.
          </div>
        )}
      </div>

      {detalle && (
        <BankDetailModal
          r={detalle}
          tipoActual={tipoActual}
          moneda={inputs.moneda}
          pais={pais}
          onClose={() => setDetalle(null)}
          onRequestEmail={(r) => {
            setDetalle(null);
            setEmailBanco(r);
          }}
        />
      )}

      {emailBanco && (
        <EmailLeadModal
          r={emailBanco}
          tipoActual={tipoActual}
          moneda={inputs.moneda}
          pais={pais}
          onClose={() => setEmailBanco(null)}
          onSuccess={(nombre, email, r) => {
            setEmailBanco(null);
            setExito({ nombre, email, r });
          }}
        />
      )}

      {exito && (
        <LeadSuccessModal
          nombre={exito.nombre}
          email={exito.email}
          r={exito.r}
          onClose={() => setExito(null)}
        />
      )}
    </section>
  );
}

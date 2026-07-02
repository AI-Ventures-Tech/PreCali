"use client";

import { useEffect, useState } from "react";
import { AVISOS_LEGALES } from "@/data/avisos";
import { useComparadorSeguros } from "@/hooks/use-comparador-seguros";
import type { ResultadoSeguro } from "@/hooks/use-comparador-seguros";
import InsuranceTabs from "@/components/seguros/InsuranceTabs";
import InsuranceFields from "@/components/seguros/InsuranceFields";
import InsuranceResultList from "@/components/seguros/InsuranceResultList";
import {
  InsuranceDetailModal,
  InsuranceEmailModal,
  InsuranceLeadSuccessModal,
} from "@/components/seguros/InsuranceDetailModal";

/**
 * Puerto de la sección `#seguros` (index.html:260-381 + segurosRuntime de
 * seguros.js). Conecta el hook `useComparadorSeguros` con las pestañas, el
 * formulario y la lista de resultados. Los modales (detalle / email /
 * confirmación) se gestionan con `useState` local — igual que el orquestador
 * legacy `verDetalleSeguro` / `abrirEmailSeguro` / `mostrarConfirmacionSeguro`.
 *
 * Conserva las clases y la estructura del legacy para que styles.css aplique.
 */
export default function ComparadorSeguros() {
  const {
    pais,
    tipo,
    setTipo,
    inputs,
    setInputs,
    orden,
    setOrden,
    resultados,
  } = useComparadorSeguros();

  const year = new Date().getFullYear();

  const [detalle, setDetalle] = useState<ResultadoSeguro | null>(null);
  const [emailSeguro, setEmailSeguro] = useState<ResultadoSeguro | null>(null);
  const [exito, setExito] = useState<{
    nombre: string;
    email: string;
    r: ResultadoSeguro;
  } | null>(null);

  // Bloquea el scroll del fondo mientras hay un modal abierto (legacy body.style.overflow).
  useEffect(() => {
    const abierto = detalle || emailSeguro || exito;
    document.body.style.overflow = abierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [detalle, emailSeguro, exito]);

  // Cerrar con Escape (legacy keydown listener).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setDetalle(null);
      setEmailSeguro(null);
      setExito(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const aviso = AVISOS_LEGALES[pais.id] ?? AVISOS_LEGALES.cr;

  return (
    <section id="seguros" className="insurance-section">
      <div className="container">
        <div className="section-eyebrow">Seguros</div>
        <h2 className="section-title">Qué querés proteger</h2>
        <p className="section-sub">
          PreCali estima rangos de prima usando variables reales de cotizadores:
          valor del bien, edad, cobertura, deducible, zona y país. No reemplaza
          la cotización oficial, pero te ayuda a saber qué opción vale la pena
          revisar primero.
        </p>

        <div className="insurance-tool card">
          <div className="insurance-tool-head">
            <div>
              <h3>Elegí qué querés proteger</h3>
            </div>
          </div>

          <InsuranceTabs tipo={tipo} setTipo={setTipo} />

          <InsuranceFields
            tipo={tipo}
            inputs={inputs}
            setInputs={setInputs}
            pais={pais}
            year={year}
          />

          <div id="insurance-legal-notice" className="insurance-disclaimer">
            {aviso?.seguros ? (
              <>
                <strong>Aviso legal de seguros ({pais.nombre}):</strong>{" "}
                {aviso.seguros} {aviso.privacidad || ""}
              </>
            ) : (
              <>
                <strong>Estimación orientativa:</strong> las aseguradoras usan
                tablas actuariales privadas. PreCali aproxima rangos con
                información pública y variables típicas de cotizadores oficiales;
                el precio final lo confirma cada aseguradora.
              </>
            )}
          </div>
        </div>

        <InsuranceResultList
          resultados={resultados}
          orden={orden}
          setOrden={setOrden}
          pais={pais}
          onVerDetalle={(r) => setDetalle(r)}
          onAbrirEmail={(r) => setEmailSeguro(r)}
        />
      </div>

      {detalle && (
        <InsuranceDetailModal
          r={detalle}
          pais={pais}
          onClose={() => setDetalle(null)}
          onRequestEmail={(r) => {
            setDetalle(null);
            setEmailSeguro(r);
          }}
        />
      )}

      {emailSeguro && (
        <InsuranceEmailModal
          r={emailSeguro}
          pais={pais}
          onClose={() => setEmailSeguro(null)}
          onSuccess={(nombre, email, r) => {
            setEmailSeguro(null);
            setExito({ nombre, email, r });
          }}
        />
      )}

      {exito && (
        <InsuranceLeadSuccessModal
          nombre={exito.nombre}
          email={exito.email}
          r={exito.r}
          onClose={() => setExito(null)}
        />
      )}
    </section>
  );
}

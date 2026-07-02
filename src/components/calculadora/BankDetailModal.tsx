"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Pais, TipoPrestamo } from "@/types/precali";
import { CONFIG_TIPOS } from "@/data/config";
import type { Moneda, ResultadoBanco } from "@/hooks/calc";
import {
  etiquetaCalidadDato,
  fechaLegible,
  fmt,
  monedaInfo,
  textoCalidadDato,
} from "@/lib/format";

interface BaseModalProps {
  r: ResultadoBanco;
  tipoActual: TipoPrestamo;
  moneda: Moneda;
  pais: Pais;
  onClose: () => void;
}

/** Puerto de `verDetalle(idx)` (app.js:656-738). */
export function BankDetailModal({
  r,
  tipoActual,
  moneda,
  pais,
  onClose,
  onRequestEmail,
}: BaseModalProps & {
  onRequestEmail: (r: ResultadoBanco) => void;
}) {
  const cfg = CONFIG_TIPOS[tipoActual];
  const ratioPct = Math.round(r.ratio * 100);
  const labelMonto = cfg.prima
    ? tipoActual === "hipoteca"
      ? "Valor máx. propiedad"
      : "Valor máx. vehículo"
    : "Monto pre-aprobado";
  const valorMostrar = cfg.prima ? r.valorBien ?? 0 : r.monto;
  const finanPct = r.params.financia ? Math.round(r.params.financia * 100) : null;
  const info = monedaInfo(moneda, pais);
  const reqIntro = `Documentación pública requerida por ${r.banco.nombre} para ${
    cfg.label === "crédito hipotecario" ? "el crédito hipotecario" : "el " + cfg.label
  }. Los requisitos exactos pueden variar según tu perfil y serán confirmados por el banco al iniciar el trámite.`;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <div className="bank-logo" style={{ background: r.banco.color }}>
              {r.banco.iniciales}
            </div>
            <div>
              <div className="modal-header-name">{r.banco.nombre}</div>
              <div className="modal-header-tag">
                {r.banco.tipo} · {cfg.label}
                {etiquetaCalidadDato(r.banco)}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <h3 className="modal-section-title">Tu pre-calificación</h3>
        <div className="modal-table">
          <ModalRow label={labelMonto} value={fmt(valorMostrar, moneda, pais)} />
          <ModalRow label="Cuota mensual" value={fmt(r.cuota, moneda, pais)} />
          <ModalRow label="Total a pagar" value={fmt(r.total, moneda, pais)} />
          <ModalRow label="Total intereses" value={fmt(r.intereses, moneda, pais)} />
        </div>

        <h3 className="modal-section-title">Condiciones del banco</h3>
        <div className="modal-table">
          <ModalRow
            label="Tasa de interés"
            value={`${r.tasa.toFixed(2)}% anual (${info.codigo})`}
          />
          <ModalRow label="Plazo máximo" value={`${r.params.plazoMax} años`} />
          <ModalRow
            label="% capacidad de pago"
            value={`${ratioPct}% del ingreso`}
          />
          <ModalRow
            label="Comisión formalización"
            value={`${r.params.comision}%`}
          />
          {finanPct && (
            <ModalRow
              label="Financiamiento máx. del bien"
              value={`${finanPct}%`}
            />
          )}
          <ModalRow label="Garantía requerida" value={r.params.garantia ?? "—"} />
          <ModalRow
            label="Última verificación"
            value={fechaLegible(r.banco.verificado)}
          />
        </div>

        <h3 className="modal-section-title">Requisitos para esta solicitud</h3>
        <p className="modal-requisitos-intro">{reqIntro}</p>
        {r.params.requisitos && r.params.requisitos.length > 0 && (
          <div className="modal-requisitos">
            {r.params.requisitos.map((grupo) => (
              <div key={grupo.categoria} className="requisitos-grupo">
                <div className="requisitos-categoria">{grupo.categoria}</div>
                <ul className="requisitos-lista">
                  {grupo.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <h3 className="modal-section-title">Cómo se calcula tu monto</h3>
        <div className="modal-glosario">
          <strong>¿Por qué este monto?</strong>
          <br />
          {r.banco.nombre} acepta que la cuota mensual no supere el{" "}
          <strong>{ratioPct}%</strong> de tu ingreso bruto. Sobre tu ingreso menos
          tus deudas actuales, queda una capacidad de pago de{" "}
          <strong>{fmt(r.capacidad, moneda, pais)}</strong> mensuales. Aplicando esa
          cuota a una tasa del <strong>{r.tasa.toFixed(2)}%</strong> durante{" "}
          <strong>{r.plazoEfectivo} años</strong>, el monto financiable resulta en{" "}
          <strong>{fmt(r.monto, moneda, pais)}</strong>.
          {cfg.prima && finanPct
            ? ` El banco financia hasta el ${finanPct}% del valor del bien, por lo que tu prima determina el valor máximo.`
            : ""}
        </div>
        <div className="modal-glosario">
          <strong>Fórmula utilizada (sistema francés):</strong>
          <br />
          cuota = monto × i / (1 − (1 + i)<sup>−n</sup>), donde i = tasa mensual y
          n = número de cuotas.
        </div>
        <div className="modal-glosario">
          <strong>Glosario rápido:</strong>
          <br />
          <em>Capacidad de pago</em>: porcentaje de tu ingreso que el banco permite
          destinar a cuotas.
          <br />
          <em>Tasa nominal anual</em>: % de interés anual antes de comisiones y
          seguros.
          <br />
          <em>Comisión de formalización</em>: cargo único al desembolsar el
          préstamo.
          <br />
          <em>% financiamiento</em>: máximo del valor del bien que el banco cubre.
        </div>

        <div className="modal-actions">
          {r.params.url && (
            <a
              href={r.params.url}
              target="_blank"
              rel="noopener"
              className="modal-link-official"
            >
              Ver en sitio oficial
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </a>
          )}
          <button
            className="modal-btn-email"
            onClick={() => onRequestEmail(r)}
          >
            Enviarme el detalle por email
          </button>
          <button className="modal-btn-cancel" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <p className="modal-source">
          {textoCalidadDato(r.banco)} Datos vigentes a{" "}
          {fechaLegible(r.banco.verificado)}. Esta es una estimación referencial, no
          una oferta vinculante.
        </p>
      </div>
    </ModalOverlay>
  );
}

interface EmailLeadModalProps {
  r: ResultadoBanco;
  tipoActual: TipoPrestamo;
  moneda: Moneda;
  pais: Pais;
  onClose: () => void;
  onSuccess: (nombre: string, email: string, r: ResultadoBanco) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Puerto de `abrirEmail` + `enviarEmail` (app.js:740-901). */
export function EmailLeadModal({
  r,
  tipoActual,
  moneda,
  pais,
  onClose,
  onSuccess,
}: EmailLeadModalProps) {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [marketing, setMarketing] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = CONFIG_TIPOS[tipoActual];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Guard absoluto: sin aceptación de términos no se envía nada.
    if (!acepta) {
      setError("Aceptá los Términos y Condiciones para continuar");
      return;
    }
    if (sending) return;
    if (!nombre.trim() || !apellido.trim() || !email.trim()) {
      setError("Completá todos los campos");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Email inválido");
      return;
    }

    setSending(true);
    setError(null);

    // Envío al route handler /api/lead (S8). try/catch que SIEMPRE muestra la
    // confirmación al usuario, replicando el comportamiento del legacy.
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          "form-name": "lead-precalificacion",
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim(),
          banco: r.banco.nombre,
          "tipo-prestamo": cfg.label,
          monto: fmt(r.monto, moneda, pais),
          cuota: fmt(r.cuota, moneda, pais),
          "acepta-terminos": "sí",
          "acepta-marketing": marketing ? "sí" : "no",
          "bot-field": "",
        }).toString(),
      });
    } catch {
      // Igual mostramos confirmación al usuario (legacy behavior).
    }
    onSuccess(nombre.trim(), email.trim(), r);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="email-modal-title"
      >
        <div className="modal-header">
          <div>
            <div className="modal-header-name" id="email-modal-title" style={{ fontSize: 20 }}>
              Recibí tu simulación
            </div>
            <div className="modal-header-tag" style={{ marginTop: 4 }}>
              PDF con detalle, glosario y tabla de amortización
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div>
              <label className="input-label" htmlFor="lead-nombre">
                Nombre
              </label>
              <input
                type="text"
                id="lead-nombre"
                className="input-text"
                placeholder="María"
                autoComplete="given-name"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="lead-apellido">
                Apellido
              </label>
              <input
                type="text"
                id="lead-apellido"
                className="input-text"
                placeholder="Rodríguez"
                autoComplete="family-name"
                required
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="lead-email">
                Email
              </label>
              <input
                type="email"
                id="lead-email"
                className="input-text"
                placeholder="maria@ejemplo.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <label className="checkbox-row" htmlFor="lead-acepta">
              <input
                type="checkbox"
                id="lead-acepta"
                required
                checked={acepta}
                onChange={(e) => setAcepta(e.target.checked)}
              />
              <span>
                Acepto los{" "}
                <a href="/terminos.html" target="_blank" rel="noopener" className="legal-link">
                  Términos y Condiciones
                </a>{" "}
                y la{" "}
                <a href="/privacidad.html" target="_blank" rel="noopener" className="legal-link">
                  Política de Privacidad
                </a>{" "}
                de PreCali.
              </span>
            </label>
            <label className="checkbox-row" htmlFor="lead-marketing">
              <input
                type="checkbox"
                id="lead-marketing"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
              <span>
                Quiero recibir actualizaciones de tasas y nuevas funciones de PreCali
                (opcional, podés darte de baja cuando quieras).
              </span>
            </label>
          </div>

          {error && (
            <p style={{ color: "var(--rust)", fontSize: 13, marginTop: "0.75rem" }}>
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button
              type="submit"
              className="modal-btn-email"
              disabled={!acepta || sending}
              title={
                !acepta
                  ? "Aceptá los Términos y Condiciones para continuar"
                  : undefined
              }
            >
              {sending ? "Enviando…" : acepta ? "Enviar PDF" : "Aceptá los términos para enviar"}
            </button>
            <button type="button" className="modal-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>

        <p className="modal-source">
          Tus datos se tratan conforme a la Ley 8968 de Costa Rica. Al aceptar los
          Términos y Condiciones y la Política de Privacidad, autorizás a PreCali a
          compartir tu información con socios comerciales aliados que puedan
          ofrecerte opciones financieras personalizadas. Podés revocar tu
          consentimiento cuando quieras.
        </p>
      </div>
    </ModalOverlay>
  );
}

/** Puerto de `mostrarConfirmacion` (app.js:887-901). */
export function LeadSuccessModal({
  nombre,
  email,
  r,
  onClose,
}: {
  nombre: string;
  email: string;
  r: ResultadoBanco;
  onClose: () => void;
}) {
  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="modal success-modal"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="success-icon">✓</div>
        <h3 className="success-title">¡Listo, {nombre}!</h3>
        <p className="success-text">
          Recibimos tu solicitud. Te enviaremos a <strong>{email}</strong> el
          detalle de tu pre-calificación de {r.banco.nombre} en las próximas horas.
        </p>
        <button
          className="modal-btn-email"
          onClick={onClose}
          style={{ width: "100%" }}
        >
          Entendido
        </button>
      </div>
    </ModalOverlay>
  );
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="modal-row">
      <span className="label">{label}</span>
      <span className="val">{value}</span>
    </div>
  );
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      {children}
    </div>
  );
}

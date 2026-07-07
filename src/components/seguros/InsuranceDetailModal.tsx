"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Pais } from "@/types/precali";
import {
  avisoLegalSeguro,
  fmtSeguro,
  rangeLabelSeguro,
  type ResultadoSeguro,
} from "@/hooks/use-comparador-seguros";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ═══════════════════════ Overlay compartido ═══════════════════════ */

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

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="modal-row">
      <span className="label">{label}</span>
      <span className="val">{value}</span>
    </div>
  );
}

/* ═══════════════════════ Detalle (verDetalleSeguro) ═══════════════════════ */

interface InsuranceDetailModalProps {
  r: ResultadoSeguro;
  pais: Pais;
  onClose: () => void;
  onRequestEmail: (r: ResultadoSeguro) => void;
}

/**
 * Puerto de `verDetalleSeguro(idx)` (seguros.js:368-442). Conserva las clases
 * `.modal`, `.modal-table`, `.modal-requisitos` y `.modal-glosario` para que
 * styles.css aplique.
 */
export function InsuranceDetailModal({
  r,
  pais,
  onClose,
  onRequestEmail,
}: InsuranceDetailModalProps) {
  const codigo = monedaInfoCodigo(pais);
  const rating = r.aseguradora.rating
    ? `${r.aseguradora.rating}/10`
    : "No disponible";
  const legal = avisoLegalSeguro(pais.id);

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <div className="bank-logo" style={{ background: r.aseguradora.color }}>
              {r.aseguradora.iniciales}
            </div>
            <div>
              <div className="modal-header-name">{r.aseguradora.nombre}</div>
              <div className="modal-header-tag">
                {r.meta.productoLabel} · {pais.nombre} · {codigo}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal-section-title">Tu estimación</div>
        <div className="modal-table">
          <ModalRow label="Prima estimada" value={rangeLabelSeguro(r, pais)} />
          <ModalRow
            label="Desde"
            value={`${fmtSeguro(r.monthlyMin, pais)} / mes`}
          />
          <ModalRow label="Producto" value={r.meta.productoLabel} />
          <ModalRow label="Perfil evaluado" value={r.meta.detalle} />
          <ModalRow label="Precisión estimada" value={r.meta.precision} />
          <ModalRow label="Rating / fortaleza" value={rating} />
        </div>

        <div className="modal-section-title">Condiciones de la aseguradora</div>
        <div className="modal-table">
          <ModalRow label="Moneda" value={codigo} />
          <ModalRow
            label="Frecuencia"
            value={r.meta.frecuencia === "mensual" ? "Mensual" : "Anual"}
          />
          <ModalRow label="Cotizador oficial" value="Disponible" />
          <ModalRow label="Fuente" value="Información pública" />
        </div>

        <div className="modal-section-title">Variables usadas</div>
        <div className="modal-requisitos-intro">
          <strong>
            PreCali estima con las variables principales que piden los cotizadores.
          </strong>
          El precio final puede cambiar por historial, zona exacta, deducible,
          exclusiones, inspección y evaluación oficial.
        </div>
        <div className="modal-requisitos">
          <div className="requisitos-grupo">
            <div className="requisitos-categoria">Perfil del seguro</div>
            <ul className="requisitos-lista">
              {r.meta.variables.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="modal-section-title">Cómo leer este rango</div>
        <div className="modal-glosario">
          <p>
            <strong>PreCali estima un rango.</strong> En seguros no existe una
            cuota exacta pública como en créditos: cada aseguradora usa tablas
            actuariales privadas.
          </p>
          <p>
            <strong>Precio final:</strong> depende de historial, zona, deducible,
            coberturas adicionales y evaluación oficial.
          </p>
          <p>
            <em>{r.nota}</em>
          </p>
        </div>

        <div className="modal-section-title">Aviso legal en {pais.nombre}</div>
        <div className="modal-glosario">
          <p>
            {legal.seguros ||
              "Estimación orientativa. El precio final lo confirma la aseguradora."}
          </p>
        </div>

        <div className="modal-actions">
          <a
            href={r.cotizador}
            target="_blank"
            rel="noopener"
            className="modal-link-official"
          >
            Ir al cotizador oficial
          </a>
          <button className="modal-btn-email" onClick={() => onRequestEmail(r)}>
            Enviármelo por email
          </button>
          <button className="modal-btn-cancel" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="modal-source">
          Las primas son orientativas. PreCali no intermedia contratos de seguros.
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ═══════════════════════ Email (abrirEmailSeguro + enviarEmailSeguro) ═══════════════════════ */

interface InsuranceEmailModalProps {
  r: ResultadoSeguro;
  pais: Pais;
  onClose: () => void;
  onSuccess: (nombre: string, email: string, r: ResultadoSeguro) => void;
}

/**
 * Puerto de `abrirEmailSeguro` + `enviarEmailSeguro` (seguros.js:444-533).
 * Recolecta nombre / apellido / email + aceptación de privacidad y POSTea a
 * `/api/lead`. En try/catch SIEMPRE confirma al usuario (comportamiento legacy).
 */
export function InsuranceEmailModal({
  r,
  pais,
  onClose,
  onSuccess,
}: InsuranceEmailModalProps) {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!acepta || sending) return;
    if (!nombre.trim() || !apellido.trim() || !email.trim()) return;
    if (!EMAIL_RE.test(email.trim())) return;

    setSending(true);
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          "form-name": "lead-precalificacion",
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim(),
          pais: pais.nombre,
          "tipo-prestamo": `Seguro - ${r.meta.productoLabel}`,
          banco: r.aseguradora.nombre,
          monto: rangeLabelSeguro(r, pais),
          cuota: `${fmtSeguro(r.monthlyMin, pais)} / mes`,
          plazo: r.meta.frecuencia,
          fuente: "PreCali Seguros",
        }).toString(),
      });
    } catch {
      // Igual mostramos confirmación al usuario (legacy behavior).
    }
    onSuccess(nombre.trim(), email.trim(), r);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal modal-email" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-header-name">Enviar estimación por email</div>
            <div className="modal-header-tag">
              {r.aseguradora.nombre} · {rangeLabelSeguro(r, pais)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="seg-lead-nombre">Nombre</label>
              <input
                id="seg-lead-nombre"
                className="input-text"
                type="text"
                placeholder="Tu nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="seg-lead-apellido">Apellido</label>
              <input
                id="seg-lead-apellido"
                className="input-text"
                type="text"
                placeholder="Tu apellido"
                required
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="seg-lead-email">Email</label>
            <input
              id="seg-lead-email"
              className="input-text"
              type="email"
              placeholder="tu@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
            />
            <span>
              Acepto recibir esta estimación por correo y entiendo que es
              orientativa.
            </span>
          </label>
          <button
            className="modal-btn-email"
            type="submit"
            disabled={!acepta || sending}
          >
            {sending ? "Enviando..." : "Enviar estimación"}
          </button>
          <button className="modal-btn-cancel" type="button" onClick={onClose}>
            Cancelar
          </button>
        </form>
      </div>
    </ModalOverlay>
  );
}

/* ═══════════════════════ Confirmación (mostrarConfirmacionSeguro) ═══════════════════════ */

/**
 * Puerto de `mostrarConfirmacionSeguro` (seguros.js:535-555).
 */
export function InsuranceLeadSuccessModal({
  nombre,
  email,
  r,
  onClose,
}: {
  nombre: string;
  email: string;
  r: ResultadoSeguro;
  onClose: () => void;
}) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal modal-email" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-header-name">Estimación enviada</div>
            <div className="modal-header-tag">{r.aseguradora.nombre}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="modal-glosario">
          <p>
            <strong>Listo, {nombre}.</strong> Registramos la solicitud para enviar
            la estimación a <strong>{email}</strong>.
          </p>
          <p>
            Recordá que el precio final lo confirma la aseguradora con su
            cotizador oficial.
          </p>
        </div>
        <button className="modal-btn-email" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </ModalOverlay>
  );
}

/** Código de moneda legible para el país (puerto de `moneda().codigo`). */
function monedaInfoCodigo(pais: Pais): string {
  return pais.moneda === "USD/PAB" ? "USD" : pais.moneda;
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad — PreCali",
  description:
    "Política de Privacidad de PreCali. Cómo recolectamos, usamos y protegemos tus datos según la Ley 8968 de Costa Rica.",
  robots: { index: true, follow: true },
};

export default function PrivacidadPage() {
  return (
    <main>
      <section className="legal-section">
        <div className="container container-narrow">
          <div className="section-eyebrow">Documento legal</div>
          <h1 className="legal-title">Política de Privacidad</h1>
          <p className="legal-meta">
            Última actualización: <strong>28 de abril de 2026</strong>
          </p>

          <div className="legal-content">
            <div className="legal-highlight">
              <strong>Resumen rápido:</strong> Solo guardamos los datos que vos
              nos das voluntariamente al pedir tu PDF (nombre y email). Los
              datos que ingresás en la calculadora (ingresos, deudas) se procesan
              localmente en tu navegador y no se almacenan. Podés consultar,
              modificar o eliminar tus datos cuando quieras.
            </div>

            <div className="legal-accordions">
              <details className="metodologia legal-accordion" open>
                <summary>
                  <span className="accordion-num">01</span>
                  <span className="accordion-title">
                    Responsable del tratamiento de datos
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    El responsable del tratamiento de los datos personales
                    recolectados a través de PreCali es{" "}
                    <strong>Gabriel Chaves Romero</strong>, persona física,
                    fundador de PreCali, portador de la cédula de identidad
                    costarricense número <strong>1-1959-0710</strong>, con
                    domicilio en{" "}
                    <strong>Santa Ana, San José, Costa Rica</strong>.
                  </p>
                  <p>
                    Esta política se rige por la{" "}
                    <strong>
                      Ley N° 8968 de Protección de la Persona frente al
                      Tratamiento de sus Datos Personales
                    </strong>{" "}
                    y su Reglamento.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">02</span>
                  <span className="accordion-title">
                    Qué datos recolectamos
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    PreCali recolecta únicamente los datos que vos proporcionás
                    de forma voluntaria al solicitar el envío del detalle de tu
                    pre-calificación por correo electrónico. Estos son:
                  </p>
                  <ul>
                    <li>
                      <strong>Nombre y apellido</strong>
                    </li>
                    <li>
                      <strong>Correo electrónico</strong>
                    </li>
                    <li>
                      <strong>Resumen de tu simulación</strong> (banco
                      seleccionado, tipo de préstamo, monto y cuota estimada)
                    </li>
                  </ul>
                  <p>
                    <strong>Datos que NO recolectamos ni almacenamos:</strong>
                  </p>
                  <ul>
                    <li>
                      Tu ingreso mensual, deudas, prima u otros datos financieros
                      que ingresás en la calculadora — estos se procesan
                      localmente en tu navegador y nunca se envían a nuestros
                      servidores
                    </li>
                    <li>
                      Número de cédula, número de cuenta bancaria, ni cualquier
                      otro dato sensible
                    </li>
                    <li>
                      Información biométrica, de salud, religiosa, política o
                      sindical
                    </li>
                  </ul>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">03</span>
                  <span className="accordion-title">
                    Para qué usamos tus datos
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Los datos que recolectamos se usan exclusivamente para los
                    siguientes fines:
                  </p>
                  <ul>
                    <li>
                      <strong>Envío del PDF solicitado</strong> con el detalle de
                      tu pre-calificación, glosario y tabla de amortización
                    </li>
                    <li>
                      <strong>Comunicaciones comerciales</strong> sobre
                      actualizaciones de tasas y nuevas funciones de PreCali
                      (solo si optaste por recibirlas)
                    </li>
                    <li>
                      <strong>Compartición con socios comerciales aliados</strong>
                      , conforme al detalle de la sección 5 de esta política
                    </li>
                    <li>
                      <strong>Cumplimiento de obligaciones legales</strong> que
                      pudieran corresponder
                    </li>
                  </ul>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">04</span>
                  <span className="accordion-title">
                    Base legal del tratamiento
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    El tratamiento de tus datos personales se basa en tu{" "}
                    <strong>
                      consentimiento expreso, libre, informado e inequívoco
                    </strong>
                    , otorgado al marcar el checkbox de aceptación de estos
                    Términos y Condiciones y Política de Privacidad al solicitar
                    tu PDF.
                  </p>
                  <p>
                    Conforme al artículo 5 de la Ley 8968, este consentimiento es
                    revocable en cualquier momento, sin que ello afecte la
                    legalidad del tratamiento previo a la revocación.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">05</span>
                  <span className="accordion-title">
                    Compartición con socios comerciales aliados
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <div className="legal-highlight legal-highlight-important">
                    <strong>Esto es importante, leelo con atención.</strong>
                  </div>
                  <p>
                    PreCali puede compartir tus datos personales (nombre, correo
                    electrónico y resumen de tu pre-calificación) con{" "}
                    <strong>
                      asesores financieros independientes y socios comerciales
                      aliados
                    </strong>
                    , con el único propósito de brindarte ofertas personalizadas
                    que se ajusten a tu perfil financiero y necesidades
                    crediticias.
                  </p>
                  <p>
                    Esta compartición se realiza siempre{" "}
                    <strong>en beneficio del usuario</strong> y solo cuando dicha
                    información pueda derivar en una oferta concreta y útil para
                    tus necesidades.
                  </p>
                  <p>
                    <strong>
                      Al aceptar esta Política de Privacidad, otorgás tu
                      consentimiento expreso e informado
                    </strong>{" "}
                    para esta compartición, conforme al artículo 5 de la Ley
                    8968.
                  </p>
                  <p>
                    Los socios comerciales aliados con los que podemos compartir
                    tus datos:
                  </p>
                  <ul>
                    <li>Asesores financieros independientes registrados en Costa Rica</li>
                    <li>
                      Entidades financieras y crediticias del mercado
                      costarricense
                    </li>
                    <li>
                      Plataformas de servicios financieros aliadas que cumplan con
                      la normativa vigente
                    </li>
                  </ul>
                  <p>
                    <strong>Garantías para el usuario:</strong>
                  </p>
                  <ul>
                    <li>
                      Solo se comparten los datos mínimos necesarios para que el
                      aliado pueda ofrecerte una opción concreta
                    </li>
                    <li>
                      Cada socio aliado debe cumplir con la normativa de
                      protección de datos vigente
                    </li>
                    <li>
                      Podés revocar este consentimiento en cualquier momento
                      escribiendo a{" "}
                      <a href="mailto:privacidad@precali.net">
                        privacidad@precali.net
                      </a>
                    </li>
                    <li>
                      La revocación no afecta la legalidad del tratamiento previo
                    </li>
                  </ul>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">06</span>
                  <span className="accordion-title">
                    Por cuánto tiempo guardamos tus datos
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Conservamos tus datos durante el tiempo necesario para
                    cumplir con los fines descritos en esta política, o hasta que
                    solicités su eliminación. Concretamente:
                  </p>
                  <ul>
                    <li>
                      <strong>Datos de leads:</strong> hasta 24 meses desde tu
                      última interacción con PreCali
                    </li>
                    <li>
                      <strong>Datos compartidos con aliados:</strong> según las
                      políticas de retención de cada aliado
                    </li>
                    <li>
                      <strong>Solicitudes de revocación:</strong> mantenemos
                      registro de la revocación por motivos legales
                    </li>
                  </ul>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">07</span>
                  <span className="accordion-title">
                    Tus derechos (Derechos ARCO)
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>Conforme a la Ley 8968, tenés derecho a:</p>
                  <ul>
                    <li>
                      <strong>Acceso:</strong> conocer qué datos tenemos sobre vos
                      y cómo los usamos
                    </li>
                    <li>
                      <strong>Rectificación:</strong> corregir datos inexactos o
                      incompletos
                    </li>
                    <li>
                      <strong>Cancelación / Eliminación:</strong> solicitar la
                      eliminación de tus datos cuando ya no sean necesarios
                    </li>
                    <li>
                      <strong>Oposición:</strong> oponerte al tratamiento de tus
                      datos para fines específicos
                    </li>
                    <li>
                      <strong>Revocación del consentimiento:</strong> retirar el
                      consentimiento previamente otorgado
                    </li>
                    <li>
                      <strong>Portabilidad:</strong> recibir tus datos en formato
                      estructurado para transferirlos a otro responsable
                    </li>
                  </ul>
                  <p>
                    Para ejercer cualquiera de estos derechos, escribinos a{" "}
                    <strong>
                      <a href="mailto:privacidad@precali.net">
                        privacidad@precali.net
                      </a>
                    </strong>{" "}
                    indicando claramente cuál derecho querés ejercer y adjuntando
                    una copia de tu cédula para verificar tu identidad.
                    Responderemos en un plazo máximo de{" "}
                    <strong>5 días hábiles</strong>.
                  </p>
                  <p>
                    Si considerás que no hemos atendido adecuadamente tu
                    solicitud, podés escribir nuevamente a{" "}
                    <a href="mailto:privacidad@precali.net">
                      privacidad@precali.net
                    </a>{" "}
                    indicando claramente la situación, o presentar una denuncia
                    ante la autoridad costarricense competente en materia de
                    protección de datos personales.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">08</span>
                  <span className="accordion-title">Seguridad de los datos</span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Implementamos medidas técnicas y organizativas razonables
                    para proteger tus datos personales contra acceso no
                    autorizado, alteración, divulgación o destrucción, incluyendo:
                  </p>
                  <ul>
                    <li>Cifrado HTTPS en toda la comunicación con el sitio</li>
                    <li>
                      Almacenamiento en servidores con estándares de seguridad
                      reconocidos
                    </li>
                    <li>Acceso restringido a los datos al personal autorizado</li>
                    <li>Auditorías periódicas de las prácticas de seguridad</li>
                  </ul>
                  <p>
                    <strong>Importante:</strong> ningún sistema digital es 100%
                    seguro. Si llegáramos a detectar una vulneración de seguridad
                    que afecte tus datos, te notificaremos en un plazo no mayor a
                    5 días hábiles desde su detección.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">09</span>
                  <span className="accordion-title">
                    Cookies y tecnologías similares
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    PreCali utiliza únicamente{" "}
                    <strong>cookies técnicas necesarias</strong> para el
                    funcionamiento del sitio. No usamos cookies de seguimiento
                    publicitario de terceros, ni cookies de redes sociales.
                  </p>
                  <p>
                    Si en el futuro implementamos herramientas de analítica web
                    (como Google Analytics o Plausible), actualizaremos esta
                    política y te lo notificaremos.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">10</span>
                  <span className="accordion-title">
                    Transferencias internacionales
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Tus datos se almacenan en servidores que pueden estar
                    ubicados fuera de Costa Rica (por ejemplo, servicios de
                    hosting como Netlify). Estas transferencias se realizan a
                    países que cuentan con niveles adecuados de protección de
                    datos o bajo cláusulas contractuales que garantizan tu
                    privacidad.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">11</span>
                  <span className="accordion-title">
                    Datos de menores de edad
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    PreCali está dirigido a personas mayores de 18 años. No
                    recolectamos intencionalmente datos de menores de edad. Si
                    detectamos que un menor nos ha proporcionado datos sin
                    autorización de sus padres o tutores, procederemos a
                    eliminarlos inmediatamente.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">12</span>
                  <span className="accordion-title">
                    Modificaciones a esta política
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Podemos actualizar esta Política de Privacidad para reflejar
                    cambios en nuestras prácticas, en la legislación aplicable o
                    en los servicios ofrecidos. Cualquier cambio sustancial será
                    notificado a través del sitio o por correo electrónico (cuando
                    corresponda).
                  </p>
                  <p>
                    Te recomendamos revisar esta política periódicamente. La
                    fecha de última actualización se muestra al inicio del
                    documento.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">13</span>
                  <span className="accordion-title">Contacto</span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Para cualquier consulta sobre esta Política de Privacidad o
                    sobre el tratamiento de tus datos personales, podés
                    escribirnos a:
                  </p>
                  <ul>
                    <li>
                      Privacidad y datos personales (recomendado):{" "}
                      <a href="mailto:privacidad@precali.net">
                        privacidad@precali.net
                      </a>
                    </li>
                    <li>
                      Consultas generales:{" "}
                      <a href="mailto:hola@precali.net">hola@precali.net</a>
                    </li>
                    <li>
                      Contacto directo con el fundador:{" "}
                      <a href="mailto:gabriel@precali.net">
                        gabriel@precali.net
                      </a>
                    </li>
                  </ul>
                </div>
              </details>

              <div className="legal-footer-note">
                <p>
                  <strong>Recordá:</strong> al solicitar el envío de tu
                  pre-calificación por email y aceptar esta política, otorgás tu
                  consentimiento expreso para el tratamiento de tus datos en los
                  términos descritos, incluyendo la posible compartición con
                  socios comerciales aliados de PreCali en beneficio del
                  usuario.
                </p>
              </div>
            </div>

            <p style={{ textAlign: "center", marginTop: "2.5rem" }}>
              <Link href="/" className="btn-primary">
                Volver al inicio
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

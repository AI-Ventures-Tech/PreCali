import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y Condiciones — PreCali",
  description:
    "Términos y condiciones de uso de PreCali, comparador independiente de préstamos en Costa Rica.",
  robots: { index: true, follow: true },
};

export default function TerminosPage() {
  return (
    <main>
      <section className="legal-section">
        <div className="container container-narrow">
          <div className="section-eyebrow">Documento legal</div>
          <h1 className="legal-title">Términos y Condiciones de Uso</h1>
          <p className="legal-meta">
            Última actualización: <strong>28 de abril de 2026</strong>
          </p>

          <div className="legal-content">
            <div className="legal-accordions">
              <details className="metodologia legal-accordion" open>
                <summary>
                  <span className="accordion-num">01</span>
                  <span className="accordion-title">
                    Identificación del responsable
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    El presente sitio web (en adelante &quot;PreCali&quot; o
                    &quot;la herramienta&quot;) es operado por{" "}
                    <strong>Gabriel Chaves Romero</strong>, persona física,
                    fundador de PreCali, portador de la cédula de identidad
                    costarricense número <strong>1-1959-0710</strong>, con
                    domicilio en <strong>Santa Ana, San José, Costa Rica</strong>.
                  </p>
                  <p>
                    Para cualquier consulta, podés contactarnos a través del
                    correo electrónico{" "}
                    <a href="mailto:gabriel@precali.net">gabriel@precali.net</a>.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">02</span>
                  <span className="accordion-title">
                    Naturaleza del servicio
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    PreCali es una{" "}
                    <strong>
                      herramienta digital de comparación e información
                      financiera
                    </strong>{" "}
                    que permite a los usuarios obtener pre-calificaciones
                    referenciales sobre préstamos personales, vehiculares e
                    hipotecarios ofrecidos por diferentes entidades bancarias y
                    financieras en Costa Rica.
                  </p>
                  <p>
                    <strong>
                      PreCali NO es una entidad bancaria, financiera, ni asesor
                      de inversiones
                    </strong>
                    . No estamos regulados por la Superintendencia General de
                    Entidades Financieras (SUGEF) ni intermediamos transacciones
                    financieras. No otorgamos préstamos ni representamos a ninguna
                    entidad bancaria.
                  </p>
                  <p>
                    La información que ofrecemos tiene fines exclusivamente{" "}
                    <strong>informativos y comparativos</strong>, basados en
                    información pública disponible en los sitios web oficiales de
                    las entidades financieras y reportes regulatorios de SUGEF.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">03</span>
                  <span className="accordion-title">
                    Alcance y limitaciones de las pre-calificaciones
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Las pre-calificaciones generadas por PreCali son{" "}
                    <strong>
                      estimaciones de carácter referencial y no vinculante
                    </strong>
                    . La aprobación final de cualquier crédito, así como las
                    condiciones específicas (tasa de interés, plazo, monto,
                    garantías), dependen exclusivamente del análisis crediticio
                    que realice la entidad financiera correspondiente.
                  </p>
                  <p>
                    Factores que PreCali NO considera en sus estimaciones, pero
                    que sí pueden afectar la decisión de un banco, incluyen sin
                    limitación:
                  </p>
                  <ul>
                    <li>
                      Historial crediticio en el Centro de Información
                      Crediticia (CIC) de SUGEF
                    </li>
                    <li>Antigüedad laboral y estabilidad de ingresos</li>
                    <li>Sector económico al que pertenece el solicitante</li>
                    <li>Score interno de cada entidad bancaria</li>
                    <li>Productos financieros vigentes con la entidad</li>
                    <li>
                      Garantías adicionales que el solicitante pueda ofrecer
                    </li>
                  </ul>
                  <p>
                    Las tasas, plazos y porcentajes mostrados se actualizan
                    periódicamente, pero pueden variar entre actualizaciones. La
                    fecha de última verificación de cada banco se muestra en la
                    sección &quot;Metodología&quot; del sitio.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">04</span>
                  <span className="accordion-title">
                    Uso aceptable de la herramienta
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>Al utilizar PreCali, te comprometés a:</p>
                  <ul>
                    <li>
                      Proporcionar información veraz, exacta y actualizada en los
                      campos del simulador
                    </li>
                    <li>
                      No utilizar la herramienta para fines ilícitos,
                      fraudulentos o no autorizados
                    </li>
                    <li>
                      No intentar acceder, modificar, dañar o interferir con el
                      funcionamiento del sitio
                    </li>
                    <li>
                      No realizar ingeniería inversa, copia o redistribución del
                      código o contenido sin autorización
                    </li>
                    <li>
                      No utilizar bots, scrapers o sistemas automatizados para
                      acceder masivamente a la herramienta
                    </li>
                  </ul>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">05</span>
                  <span className="accordion-title">Propiedad intelectual</span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    El diseño, código, texto, gráficos, logotipos y demás
                    elementos del sitio web PreCali son{" "}
                    <strong>propiedad de Gabriel Chaves Romero</strong>, salvo
                    aquellos elementos que pertenezcan a terceros (logotipos y
                    marcas de los bancos comparados, que son propiedad de sus
                    respectivos titulares).
                  </p>
                  <p>
                    Las marcas, nombres comerciales y logotipos de las entidades
                    bancarias mencionadas en este sitio son propiedad de sus
                    respectivos titulares y se utilizan únicamente con fines
                    informativos y de identificación, sin que ello implique
                    vinculación, patrocinio o aprobación por parte de dichas
                    entidades.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">06</span>
                  <span className="accordion-title">
                    Tratamiento de datos personales
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    El tratamiento de datos personales recolectados a través de
                    PreCali se rige por nuestra{" "}
                    <a href="/privacidad">Política de Privacidad</a>, que forma
                    parte integral de estos Términos y Condiciones.
                  </p>
                  <p>
                    <strong>Importante:</strong> al solicitar el envío del
                    detalle de tu pre-calificación por correo electrónico,
                    otorgás tu consentimiento expreso para el tratamiento de tus
                    datos conforme a la Política de Privacidad, incluyendo la
                    posible compartición con socios comerciales aliados de
                    PreCali en beneficio del usuario, según se detalla en dicha
                    política.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">07</span>
                  <span className="accordion-title">
                    Comunicaciones comerciales
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Al solicitar tu pre-calificación por correo electrónico,
                    podrás optar (de forma voluntaria) por recibir comunicaciones
                    de PreCali sobre:
                  </p>
                  <ul>
                    <li>
                      Actualizaciones de tasas de interés del mercado
                      costarricense
                    </li>
                    <li>Nuevas funciones o herramientas disponibles</li>
                    <li>Información financiera relevante para tu perfil</li>
                  </ul>
                  <p>
                    Podés darte de baja de estas comunicaciones en cualquier
                    momento haciendo clic en el enlace de &quot;cancelar
                    suscripción&quot; presente en cada correo, o escribiendo a{" "}
                    <a href="mailto:privacidad@precali.net">
                      privacidad@precali.net
                    </a>
                    .
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">08</span>
                  <span className="accordion-title">
                    Limitación de responsabilidad
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    PreCali se proporciona <strong>&quot;tal cual&quot;</strong>
                    , sin garantías expresas o implícitas sobre la exactitud,
                    integridad o actualidad de la información mostrada.
                  </p>
                  <p>
                    En la máxima medida permitida por la ley costarricense,
                    Gabriel Chaves Romero, operador de PreCali, no será
                    responsable por:
                  </p>
                  <ul>
                    <li>
                      Decisiones financieras tomadas por el usuario con base en
                      las estimaciones de la herramienta
                    </li>
                    <li>
                      Diferencias entre las estimaciones mostradas y las
                      condiciones finales ofrecidas por las entidades bancarias
                    </li>
                    <li>
                      Pérdidas, daños o perjuicios derivados del uso o
                      imposibilidad de uso del sitio
                    </li>
                    <li>
                      Interrupciones del servicio por causas técnicas, de fuerza
                      mayor o de terceros
                    </li>
                    <li>
                      Contenido o políticas de los sitios web de terceros
                      enlazados desde PreCali
                    </li>
                  </ul>
                  <p>
                    El usuario reconoce que cualquier decisión crediticia es de
                    su exclusiva responsabilidad y debe ser tomada después de
                    consultar directamente con la entidad bancaria de su elección
                    y, cuando corresponda, con un asesor financiero profesional.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">09</span>
                  <span className="accordion-title">
                    Modificaciones a los Términos
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    PreCali se reserva el derecho de modificar estos Términos y
                    Condiciones en cualquier momento. Los cambios se publicarán
                    en esta misma página, indicando la fecha de la última
                    actualización al inicio del documento.
                  </p>
                  <p>
                    El uso continuado de la herramienta después de la publicación
                    de cambios constituye la aceptación de los nuevos términos.
                    Te recomendamos revisar este documento periódicamente.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">10</span>
                  <span className="accordion-title">
                    Ley aplicable y jurisdicción
                  </span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Estos Términos y Condiciones se rigen por las leyes de la{" "}
                    <strong>República de Costa Rica</strong>. Cualquier
                    controversia derivada del uso de PreCali será resuelta ante
                    los <strong>tribunales civiles de San José, Costa Rica</strong>
                    , renunciando las partes a cualquier otro fuero que pudiera
                    corresponderles.
                  </p>
                </div>
              </details>

              <details className="metodologia legal-accordion">
                <summary>
                  <span className="accordion-num">11</span>
                  <span className="accordion-title">Contacto</span>
                </summary>
                <div className="meto-body legal-accordion-body">
                  <p>
                    Para cualquier consulta, comentario o reclamo relacionado con
                    estos Términos y Condiciones, podés escribirnos a:
                  </p>
                  <ul>
                    <li>
                      Consultas generales:{" "}
                      <a href="mailto:hola@precali.net">hola@precali.net</a>
                    </li>
                    <li>
                      Privacidad y datos personales:{" "}
                      <a href="mailto:privacidad@precali.net">
                        privacidad@precali.net
                      </a>
                    </li>
                    <li>
                      Reportar datos desactualizados de bancos:{" "}
                      <a href="mailto:datos@precali.net">datos@precali.net</a>
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
                  <strong>Recordá:</strong> al utilizar PreCali aceptás estos
                  Términos y Condiciones en su totalidad. Si no estás de acuerdo
                  con alguna parte, te pedimos que no utilices la herramienta.
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

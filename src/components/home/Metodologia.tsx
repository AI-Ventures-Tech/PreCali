interface MetodologiaItem {
  summary: string;
  open?: boolean;
  body: React.ReactNode;
}

const METODOLOGIA_ITEMS: MetodologiaItem[] = [
  {
    summary: "De dónde vienen los datos",
    open: true,
    body:
      "Las tasas, plazos y porcentajes de cada banco se obtienen directamente de sus sitios web oficiales, folletos PDF públicos y reportes regulatorios publicados ante SUGEF. No tenemos acuerdos comerciales con ningún banco que altere los resultados mostrados. Los datos se revisan al menos cada 30 días, y adicionalmente cada vez que el BCCR publica nuevos topes (enero y julio de cada año).",
  },
  {
    summary: "Cómo calculamos tu monto",
    body: (
      <>
        Aplicamos el sistema francés de amortización, el mismo que utilizan los bancos
        costarricenses. La fórmula es:{" "}
        <code>
          cuota = monto × i / (1 − (1 + i)<sup>−n</sup>)
        </code>
        , donde <em>i</em> es la tasa mensual y <em>n</em> el número de cuotas. Cada banco
        define su propio porcentaje máximo de capacidad de pago (28%-40%), tasa nominal y
        plazo máximo. Para vehículo e hipoteca aplicamos el límite de financiamiento sobre
        el valor del bien (80%-95%).
      </>
    ),
  },
  {
    summary: "Cómo funciona el análisis con IA",
    body:
      "El módulo de Análisis Inteligente evalúa todos los bancos seleccionados según el criterio que elijas en el filtro. No es solo el primer banco de la lista: analizamos brechas relativas entre opciones, identificamos puntos de equilibrio (un banco con cuota mayor pero ahorro significativo en intereses, por ejemplo) y traducimos los números a una recomendación contextual. La IA da el análisis para que decidás con información clara.",
  },
  {
    summary: "Qué factores no consideramos",
    body:
      "No incluimos: tu historial CIC (Centro de Información Crediticia de SUGEF), antigüedad laboral, sector donde trabajás, score interno con el banco, ni descuentos especiales por ser cliente afiliado o empleado de planilla. Estos factores pueden hacer que tu oferta real sea mejor o peor que nuestra estimación.",
  },
  {
    summary: "Última verificación por banco",
    body: (
      <div className="meto-body">
        <div id="verificaciones" className="verif-grid"></div>
      </div>
    ),
  },
  {
    summary: "Reportar dato desactualizado",
    body: (
      <>
        Si detectaste que una tasa, plazo o condición de algún banco está desactualizada,
        escribinos a <a href="mailto:datos@precali.net">datos@precali.net</a> con un enlace
        al sitio oficial. Verificamos en menos de 48 horas.
      </>
    ),
  },
];

export default function Metodologia() {
  return (
    <section id="metodologia" className="methodology-section">
      <div className="container">
        <div className="section-eyebrow">Transparencia</div>
        <h2 className="section-title">Metodología</h2>
        <p className="section-sub">
          Todas las estimaciones se basan en información pública. Acá explicamos cómo
          recopilamos los datos, qué fórmulas usamos y cuándo verificamos cada banco.
        </p>

        <div className="methodology-grid">
          {METODOLOGIA_ITEMS.map((item) => (
            <details key={item.summary} className="metodologia" open={item.open}>
              <summary>{item.summary}</summary>
              {typeof item.body === "string" ? (
                <div className="meto-body">{item.body}</div>
              ) : (
                item.body
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

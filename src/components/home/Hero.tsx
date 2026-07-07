interface QuestionCloud {
  classes: string;
  tag: string;
  question: string;
}

const QUESTION_CLOUDS: QuestionCloud[] = [
  {
    classes: "question-cloud question-cloud-large question-cloud-credit-main",
    tag: "Créditos",
    question: "¿Qué banco es mejor?",
  },
  {
    classes: "question-cloud question-cloud-medium question-cloud-credit-two",
    tag: "Créditos",
    question: "¿Cuánto me pueden prestar?",
  },
  {
    classes: "question-cloud question-cloud-small question-cloud-credit-three",
    tag: "Créditos",
    question: "¿Cuánto quedaría la cuota?",
  },
  {
    classes: "question-cloud question-cloud-large question-cloud-insurance-main",
    tag: "Seguros",
    question: "¿Qué seguro es mejor?",
  },
  {
    classes: "question-cloud question-cloud-medium question-cloud-insurance-two",
    tag: "Seguros",
    question: "¿Qué cubre realmente?",
  },
  {
    classes: "question-cloud question-cloud-small question-cloud-insurance-three",
    tag: "Seguros",
    question: "¿Cuál me conviene pagar?",
  },
];

export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero-inner">
        <div className="hero-copy">
          <h1 className="hero-title">
            Elegí mejor antes de pedir <em>crédito</em> o seguro
            <span className="cursor-blink">.</span>
          </h1>
          <p className="hero-sub">
            PreCali compara opciones de bancos y aseguradoras de tu región para que veás
            tasas, requisitos y próximos pasos con claridad. Sin posiciones vendidas, sin
            letra pequeña.
          </p>
          <div className="hero-eyebrow">
            <span className="dot"></span>
            <span>Datos públicos · créditos y seguros por país</span>
          </div>
          <div className="hero-actions" aria-label="Elegir qué comparar">
            <a
              href="#calculadora"
              className="hero-action hero-action-primary"
              data-flow-target="credito"
            >
              Comparar créditos
            </a>
            <a href="#seguros" className="hero-action" data-flow-target="seguros">
              Comparar seguros
            </a>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          {QUESTION_CLOUDS.map((cloud) => (
            <div key={cloud.classes} className={cloud.classes}>
              <span>{cloud.tag}</span>
              <strong>{cloud.question}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

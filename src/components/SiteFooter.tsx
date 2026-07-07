const FOOTER_LINKS = [
  { href: "#seguros", label: "Seguros" },
  { href: "#metodologia", label: "Metodología" },
  { href: "#contacto", label: "Contacto" },
] as const;

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <picture>
            <source srcSet="/asterisco.webp" type="image/webp" />
            <img src="/asterisco.png" alt="" className="logo-mark" />
          </picture>
          <div>
            <div className="logo-text">
              <span className="logo-pre">Pre</span>
              <span className="logo-cali">Cali</span>
            </div>
            <div className="footer-tag">
              Comparador independiente · Costa Rica
            </div>
          </div>
        </div>
        <div className="footer-links">
          {FOOTER_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <a href="/terminos">Términos y Condiciones</a>
          <a href="/privacidad">Privacidad</a>
        </div>
        <div className="footer-legal">
          <p>
            © 2026 PreCali · Esta herramienta no es un banco ni una entidad
            financiera. Las pre-calificaciones son estimaciones referenciales
            basadas en información pública.
          </p>
        </div>
      </div>
    </footer>
  );
}

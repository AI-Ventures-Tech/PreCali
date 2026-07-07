import CountrySelect from "./CountrySelect";

const NAV_LINKS = [
  { href: "#calculadora", label: "Créditos" },
  { href: "#seguros", label: "Seguros" },
  { href: "#metodologia", label: "Metodología" },
  { href: "#contacto", label: "Contacto" },
] as const;

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="#top" className="logo" aria-label="PreCali — Ir al inicio">
          <picture>
            <source srcSet="/asterisco.webp" type="image/webp" />
            <img src="/asterisco.png" alt="" className="logo-mark" />
          </picture>
          <span className="logo-text">
            <span className="logo-pre">Pre</span>
            <span className="logo-cali">Cali</span>
          </span>
        </a>
        <nav className="nav-links">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <CountrySelect />
      </div>
    </header>
  );
}

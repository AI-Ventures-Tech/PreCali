"use client";

import { useCallback, useEffect, useState } from "react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggle = () => setVisible(window.scrollY > 520);
    toggle();
    window.addEventListener("scroll", toggle, { passive: true });
    return () => window.removeEventListener("scroll", toggle);
  }, []);

  const handleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <button
      className={`back-to-top${visible ? " is-visible" : ""}`}
      id="back-to-top"
      type="button"
      aria-label="Volver arriba"
      tabIndex={visible ? 0 : -1}
      onClick={handleClick}
    >
      <span aria-hidden="true">↑</span>
      <span>Arriba</span>
    </button>
  );
}

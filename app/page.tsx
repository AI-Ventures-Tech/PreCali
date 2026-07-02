import BackToTop from "@/components/BackToTop";
import ModalHost from "@/components/ModalHost";
import ScrollProgress from "@/components/ScrollProgress";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import AvisosLegales from "@/components/home/AvisosLegales";
import Contacto from "@/components/home/Contacto";
import Hero from "@/components/home/Hero";
import Metodologia from "@/components/home/Metodologia";
import CalculadoraCreditos from "@/components/calculadora/CalculadoraCreditos";
import ComparadorSeguros from "@/components/seguros/ComparadorSeguros";

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <SiteHeader />
      <main>
        <Hero />
        <CalculadoraCreditos />
        <ComparadorSeguros />
        <Metodologia />
        <Contacto />
        <AvisosLegales />
      </main>
      <SiteFooter />
      <BackToTop />
      <ModalHost />
    </>
  );
}

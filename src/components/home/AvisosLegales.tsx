import { AVISOS_LEGALES } from "@/data/avisos";
import type { PaisId } from "@/types/precali";

interface AvisosLegalesProps {
  pais?: PaisId;
}

export default function AvisosLegales({ pais = "cr" }: AvisosLegalesProps) {
  const texto = AVISOS_LEGALES[pais]?.creditos;

  if (!texto) {
    return null;
  }

  return (
    <div className="disclaimer-box">
      <strong>Aviso legal:</strong> {texto}
    </div>
  );
}

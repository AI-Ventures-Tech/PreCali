import type { AvisoLegal, PaisId } from '../types/precali';

export const AVISOS_LEGALES: Partial<Record<PaisId, AvisoLegal>> = {
  "cr": {
    "creditos": "Estimación referencial basada en información pública de bancos y cooperativas supervisadas. La aprobación final, monto y tasa dependen del análisis de cada entidad, historial crediticio, capacidad de pago, garantía y políticas internas. En Costa Rica pueden aplicar consultas al CIC/SUGEF cuando la entidad autorizada evalúe formalmente el crédito.",
    "seguros": "Estimación orientativa basada en información pública del mercado asegurador costarricense. El precio final, deducibles, exclusiones y aceptación los confirma cada aseguradora o intermediario autorizado bajo la supervisión de SUGESE. PreCali no emite pólizas ni sustituye una cotización oficial.",
    "privacidad": "Los datos personales deben tratarse conforme a la Ley 8968 y al consentimiento del usuario; PreCali muestra comparaciones informativas y no constituye una oferta vinculante."
  }
};

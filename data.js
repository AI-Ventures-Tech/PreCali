// Mercado activo de PreCali para el MVP: Costa Rica.
// La data regional completa queda respaldada en backups/data-regional-2026-06-29.js.
const PAISES = [
  {
    "id": "cr",
    "nombre": "Costa Rica",
    "bandera": "🇨🇷",
    "moneda": "CRC",
    "simbolo": "₡",
    "cambioUSD": 510,
    "estado": "activo",
    "bancos": 8
  }
];

const AVISOS_LEGALES = {
  "cr": {
    "creditos": "Estimación referencial basada en información pública de bancos y cooperativas supervisadas. La aprobación final, monto y tasa dependen del análisis de cada entidad, historial crediticio, capacidad de pago, garantía y políticas internas. En Costa Rica pueden aplicar consultas al CIC/SUGEF cuando la entidad autorizada evalúe formalmente el crédito.",
    "seguros": "Estimación orientativa basada en información pública del mercado asegurador costarricense. El precio final, deducibles, exclusiones y aceptación los confirma cada aseguradora o intermediario autorizado bajo la supervisión de SUGESE. PreCali no emite pólizas ni sustituye una cotización oficial.",
    "privacidad": "Los datos personales deben tratarse conforme a la Ley 8968 y al consentimiento del usuario; PreCali muestra comparaciones informativas y no constituye una oferta vinculante."
  }
};

// Datos de bancos costarricenses.
// Fuente: sitios oficiales de cada banco, vigentes a enero 2026.
const BANCOS = [
  {
    "id": "bn",
    "nombre": "Banco Nacional",
    "color": "#005CAB",
    "iniciales": "BN",
    "tipo": "Público",
    "web": "https://www.bncr.fi.cr",
    "verificado": "2026-01-15",
    "personal": {
      "tasaCRC": 16.5,
      "tasaUSD": 12,
      "plazoMax": 8,
      "ratioMax": 0.4,
      "comision": 2.5,
      "ingresoMin": 350000,
      "montoMin": 500000,
      "url": "https://www.bncr.fi.cr/personas/financiamiento/calculadora-de-credito",
      "garantia": "Fiduciaria o sin garantía según monto",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad costarricense vigente y en buen estado",
            "Para extranjeros: cédula de residencia permanente vigente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial original con menos de 30 días de emisión",
            "Tres últimas órdenes patronales o colillas de pago",
            "Para independientes: declaración del impuesto sobre la renta del último período fiscal",
            "Para independientes: estados de cuenta bancarios de los últimos 6 meses"
          ]
        },
        {
          "categoria": "Información laboral",
          "items": [
            "Antigüedad laboral mínima de 6 meses en el empleo actual",
            "Constancia de la CCSS de aseguramiento"
          ]
        },
        {
          "categoria": "Información financiera",
          "items": [
            "Carta de SUGEF (Centro de Información Crediticia)",
            "Detalle de deudas vigentes y referencias crediticias"
          ]
        }
      ]
    },
    "vehiculo": {
      "tasaCRC": 11.5,
      "tasaUSD": 8.5,
      "plazoMax": 8,
      "ratioMax": 0.4,
      "comision": 2,
      "financia": 0.85,
      "ingresoMin": 400000,
      "montoMin": 2000000,
      "url": "https://www.bncr.fi.cr/personas/financiamiento/calculadora-de-credito",
      "garantia": "Prendaria sobre el vehículo",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad costarricense vigente",
            "Cédula del cónyuge si aplica (para vehículos en bienes gananciales)"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Tres últimas órdenes patronales",
            "Para independientes: declaración de renta y estados bancarios de 6 meses"
          ]
        },
        {
          "categoria": "Documentos del vehículo",
          "items": [
            "Factura proforma del concesionario o vendedor",
            "Para usados: certificación registral del vehículo (RNP)",
            "Antigüedad máxima del vehículo: 7 años al momento de la solicitud"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Constitución de garantía prendaria sobre el vehículo",
            "Póliza de seguro contra todo riesgo (obligatoria durante toda la vigencia)",
            "Avalúo cuando aplique"
          ]
        }
      ]
    },
    "hipoteca": {
      "tasaCRC": 8.5,
      "tasaUSD": 7.75,
      "plazoMax": 30,
      "ratioMax": 0.35,
      "comision": 2,
      "financia": 0.9,
      "ingresoMin": 600000,
      "montoMin": 15000000,
      "url": "https://www.bncr.fi.cr/personas/financiamiento/calculadora-de-credito/calculadora-vivienda",
      "garantia": "Hipotecaria o fideicomiso",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad vigente del solicitante y cónyuge",
            "Constancia de estado civil reciente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial original (menos de 30 días)",
            "Órdenes patronales de los últimos 3 meses",
            "Estados de cuenta bancarios de los últimos 6 meses",
            "Para independientes: 2 últimas declaraciones de renta"
          ]
        },
        {
          "categoria": "Documentos de la propiedad",
          "items": [
            "Estudio registral actualizado (menos de 30 días)",
            "Plano catastrado vigente",
            "Avalúo realizado por perito autorizado por el banco",
            "Certificación de la municipalidad sobre uso de suelo"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Constitución de hipoteca de primer grado o fideicomiso",
            "Póliza de incendio sobre la propiedad",
            "Póliza de saldo deudor (vida del deudor)"
          ]
        }
      ]
    }
  },
  {
    "id": "bcr",
    "nombre": "Banco de Costa Rica",
    "color": "#004FA3",
    "iniciales": "BCR",
    "tipo": "Público",
    "web": "https://www.bancobcr.com",
    "verificado": "2026-01-15",
    "personal": {
      "tasaCRC": 17,
      "tasaUSD": 12.5,
      "plazoMax": 8,
      "ratioMax": 0.38,
      "comision": 3,
      "ingresoMin": 400000,
      "montoMin": 500000,
      "url": "https://www.bancobcr.com/wps/portal/bcr/bancobcr/personas/prestamos/personal-consumo",
      "garantia": "Fiduciaria, fideicomiso o back-to-back",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad vigente",
            "Para extranjeros: cédula de residencia permanente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial reciente con menos de 30 días",
            "Tres últimas colillas de pago u órdenes patronales",
            "Estados de cuenta bancarios de los últimos 3 a 6 meses",
            "Para independientes: declaración del impuesto sobre la renta"
          ]
        },
        {
          "categoria": "Análisis crediticio",
          "items": [
            "Análisis con scoring SUGEF (Centro de Información Crediticia)",
            "Historial crediticio sin atrasos significativos en últimos 12 meses",
            "Comisión de formalización del 3% sobre el monto aprobado"
          ]
        },
        {
          "categoria": "Garantías",
          "items": [
            "Fiador solidario para montos mayores",
            "Opción de fideicomiso de garantía o back-to-back con depósitos a plazo"
          ]
        }
      ]
    },
    "vehiculo": {
      "tasaCRC": 12,
      "tasaUSD": 9,
      "plazoMax": 7,
      "ratioMax": 0.38,
      "comision": 2.5,
      "financia": 0.85,
      "ingresoMin": 450000,
      "montoMin": 2000000,
      "url": "https://www.bancobcr.com/wps/portal/bcr/bancobcr/personas/prestamos",
      "garantia": "Prendaria sobre el vehículo",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula vigente del solicitante",
            "Estado civil documentado"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Tres últimas órdenes patronales",
            "Para independientes: dos últimas declaraciones de renta"
          ]
        },
        {
          "categoria": "Documentos del vehículo",
          "items": [
            "Factura proforma del concesionario",
            "Para vehículo usado: certificación registral del vehículo",
            "Antigüedad máxima según política vigente del banco"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Garantía prendaria inscrita ante el Registro Nacional",
            "Póliza de seguro contra todo riesgo durante toda la vigencia",
            "Comisión de formalización del 2.5%"
          ]
        }
      ]
    },
    "hipoteca": {
      "tasaCRC": 8.75,
      "tasaUSD": 8,
      "plazoMax": 30,
      "ratioMax": 0.35,
      "comision": 2,
      "financia": 0.9,
      "ingresoMin": 700000,
      "montoMin": 15000000,
      "url": "https://www.bancobcr.com/wps/portal/bcr/bancobcr/personas/prestamos/vivienda-mi-casa",
      "garantia": "Hipoteca, hipoteca abierta o fideicomiso",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula del solicitante y cónyuge",
            "Certificación de estado civil reciente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Órdenes patronales de los últimos 3 meses",
            "Estados de cuenta bancarios de los últimos 6 meses",
            "Para independientes: 2 declaraciones de renta + certificación de contador público"
          ]
        },
        {
          "categoria": "Documentos de la propiedad",
          "items": [
            "Estudio registral actualizado",
            "Plano catastrado original",
            "Avalúo financiable realizado por perito autorizado",
            "Permisos de construcción si aplica"
          ]
        },
        {
          "categoria": "Comisiones y garantías",
          "items": [
            "Comisión 2% en colones, hasta 3.5% en dólares (riesgo cambiario)",
            "Hipoteca de primer grado o fideicomiso de garantía",
            "Pólizas obligatorias: incendio + saldo deudor"
          ]
        }
      ]
    }
  },
  {
    "id": "bac",
    "nombre": "BAC Credomatic",
    "color": "#E30613",
    "iniciales": "BAC",
    "tipo": "Privado",
    "web": "https://www.baccredomatic.com/es-cr",
    "verificado": "2026-01-20",
    "personal": {
      "tasaCRC": 24,
      "tasaUSD": 13.5,
      "plazoMax": 5,
      "ratioMax": 0.35,
      "comision": 0,
      "ingresoMin": 500000,
      "montoMin": 500000,
      "url": "https://www.baccredomatic.com/es-cr/personas/prestamos/personales",
      "garantia": "Vinculado a tarjeta de crédito BAC",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad vigente",
            "Para extranjeros: cédula de residencia",
            "Comprobante de domicilio reciente (recibo de servicios)"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial reciente",
            "Para asalariados: tres últimas órdenes patronales",
            "Para independientes: estados financieros y declaración de renta",
            "Estados de cuenta bancarios de los últimos 3 meses"
          ]
        },
        {
          "categoria": "Condiciones especiales",
          "items": [
            "Plazo máximo de 60 meses (5 años)",
            "Tasas referenciales entre 22% y 28% en colones según perfil",
            "Sin comisión de desembolso",
            "Cancelación anticipada sin penalidad",
            "Cliente preferente con tarjeta BAC obtiene mejores condiciones"
          ]
        }
      ]
    },
    "vehiculo": {
      "tasaCRC": 10.9,
      "tasaUSD": 8.25,
      "plazoMax": 8,
      "ratioMax": 0.35,
      "comision": 2,
      "financia": 0.85,
      "ingresoMin": 600000,
      "montoMin": 3000000,
      "url": "https://www.baccredomatic.com/es-cr/personas/prestamos",
      "garantia": "Prendaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula vigente del solicitante",
            "Estado civil documentado"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Órdenes patronales de los últimos 3 meses",
            "Estados de cuenta de los últimos 3 a 6 meses"
          ]
        },
        {
          "categoria": "Documentos del vehículo",
          "items": [
            "Factura proforma del concesionario o vendedor",
            "Para vehículos usados: revisión técnica al día",
            "Certificación registral del vehículo (RNP)"
          ]
        },
        {
          "categoria": "Seguros obligatorios",
          "items": [
            "Seguro de saldo deudor obligatorio",
            "Seguro contra todo riesgo del vehículo durante toda la vigencia",
            "Constitución de prenda inscrita ante el Registro Nacional"
          ]
        }
      ]
    },
    "hipoteca": {
      "tasaCRC": 8,
      "tasaUSD": 7.25,
      "plazoMax": 30,
      "ratioMax": 0.32,
      "comision": 2,
      "financia": 0.8,
      "ingresoMin": 900000,
      "montoMin": 25000000,
      "url": "https://www.baccredomatic.com/es-cr/personas/prestamos/hipotecarios",
      "garantia": "Hipotecaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula del solicitante y cónyuge",
            "Certificación de estado civil"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial reciente",
            "Tres últimas órdenes patronales",
            "Estados de cuenta de los últimos 6 meses",
            "Para independientes: declaraciones de renta de últimos 2 períodos"
          ]
        },
        {
          "categoria": "Documentos de la propiedad",
          "items": [
            "Estudio registral del inmueble",
            "Plano catastrado vigente",
            "Avalúo realizado por perito autorizado por BAC",
            "Permisos municipales según corresponda"
          ]
        },
        {
          "categoria": "Estructura tarifaria especial",
          "items": [
            "Tasa escalonada en USD: 7.25% año 1, 8.35% año 2, luego SOFR + 4.90%",
            "Monto mínimo en USD: $10,000",
            "Pólizas de incendio + saldo deudor obligatorias",
            "Hipoteca de primer grado"
          ]
        }
      ]
    }
  },
  {
    "id": "pop",
    "nombre": "Banco Popular",
    "color": "#F58220",
    "iniciales": "POP",
    "tipo": "Público",
    "web": "https://www.bancopopular.fi.cr",
    "verificado": "2026-01-18",
    "personal": {
      "tasaCRC": 15.5,
      "tasaUSD": 11.5,
      "plazoMax": 9,
      "ratioMax": 0.4,
      "comision": 2,
      "ingresoMin": 300000,
      "montoMin": 300000,
      "url": "https://www.bancopopular.fi.cr/crediton/",
      "garantia": "Sin fiador (Creditón)",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad vigente",
            "Para extranjeros: cédula de residencia permanente o temporal vigente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial original",
            "Tres últimas órdenes patronales",
            "Para independientes: declaración del impuesto sobre la renta + estados bancarios"
          ]
        },
        {
          "categoria": "Beneficios para afiliados",
          "items": [
            "Mejores tasas para afiliados al Banco Popular",
            "Hasta 108 meses (9 años) de plazo máximo",
            "Pólizas de vida y desempleo incluidas en el crédito",
            "Sin necesidad de fiador (modalidad Creditón)"
          ]
        },
        {
          "categoria": "Análisis crediticio",
          "items": [
            "Consulta al Centro de Información Crediticia (SUGEF)",
            "Antigüedad laboral mínima requerida"
          ]
        }
      ]
    },
    "vehiculo": {
      "tasaCRC": 11,
      "tasaUSD": 8.5,
      "plazoMax": 8,
      "ratioMax": 0.4,
      "comision": 2,
      "financia": 0.9,
      "ingresoMin": 400000,
      "montoMin": 2000000,
      "url": "https://www.bancopopular.fi.cr/",
      "garantia": "Prendaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula vigente del solicitante",
            "Documentación del cónyuge si aplica"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Órdenes patronales recientes",
            "Para independientes: declaraciones de renta y movimientos bancarios"
          ]
        },
        {
          "categoria": "Documentos del vehículo",
          "items": [
            "Factura proforma del concesionario",
            "Para usados: certificación registral del Registro Nacional",
            "Financiamiento hasta el 90% del valor del vehículo"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Constitución de garantía prendaria",
            "Seguro contra todo riesgo durante toda la vigencia del crédito",
            "Pólizas accesorias incluidas"
          ]
        }
      ]
    },
    "hipoteca": {
      "tasaCRC": 8.25,
      "tasaUSD": 7.5,
      "plazoMax": 30,
      "ratioMax": 0.35,
      "comision": 1.5,
      "financia": 0.95,
      "ingresoMin": 550000,
      "montoMin": 12000000,
      "url": "https://www.bancopopular.fi.cr/",
      "garantia": "Hipotecaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula vigente del solicitante y cónyuge",
            "Certificación de estado civil"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial reciente",
            "Órdenes patronales de los últimos 3 meses",
            "Estados de cuenta bancarios de 6 meses"
          ]
        },
        {
          "categoria": "Documentos de la propiedad",
          "items": [
            "Estudio registral actualizado",
            "Plano catastrado vigente",
            "Avalúo del inmueble por perito autorizado",
            "Para construcción: permisos municipales y cronograma de obra"
          ]
        },
        {
          "categoria": "Programa FEVI y comisiones",
          "items": [
            "Programa FEVI permite hasta 100% de financiamiento en casos especiales",
            "Comisión de formalización 1.5% (una de las más bajas del mercado)",
            "Pólizas de incendio + saldo deudor obligatorias"
          ]
        }
      ]
    }
  },
  {
    "id": "dav",
    "nombre": "Davivienda",
    "color": "#ED1C27",
    "iniciales": "DAV",
    "tipo": "Privado",
    "web": "https://bienvenido.davivienda.cr",
    "verificado": "2026-01-12",
    "personal": {
      "tasaCRC": 19,
      "tasaUSD": 14,
      "plazoMax": 7,
      "ratioMax": 0.33,
      "comision": 2.5,
      "ingresoMin": 600000,
      "montoMin": 750000,
      "url": "https://bienvenido.davivienda.cr",
      "garantia": "Sin garantía",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad vigente",
            "Para extranjeros: cédula de residencia permanente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial reciente",
            "Tres últimas órdenes patronales",
            "Estados de cuenta de los últimos 3 meses",
            "Para independientes: declaración de renta + estados bancarios de 6 meses"
          ]
        },
        {
          "categoria": "Características del producto",
          "items": [
            "Tasa variable: TBP (Tasa Básica Pasiva) + margen fijo",
            "Cálculo de cuotas con base 360 días",
            "Sin necesidad de garantía real",
            "Análisis con scoring crediticio interno"
          ]
        }
      ]
    },
    "vehiculo": {
      "tasaCRC": 12.5,
      "tasaUSD": 9.5,
      "plazoMax": 7,
      "ratioMax": 0.33,
      "comision": 2.5,
      "financia": 0.8,
      "ingresoMin": 700000,
      "montoMin": 3000000,
      "url": "https://bienvenido.davivienda.cr",
      "garantia": "Prendaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula vigente del solicitante",
            "Documentación del cónyuge si el vehículo es ganancial"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Órdenes patronales recientes",
            "Estados de cuenta de los últimos 3 meses"
          ]
        },
        {
          "categoria": "Documentos del vehículo",
          "items": [
            "Factura proforma del concesionario",
            "Para usados: certificación registral del vehículo",
            "Antigüedad máxima del vehículo según política vigente"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Garantía prendaria inscrita",
            "Seguro contra todo riesgo obligatorio",
            "Comisión de formalización del 2.5%"
          ]
        }
      ]
    },
    "hipoteca": {
      "tasaCRC": 9,
      "tasaUSD": 8.25,
      "plazoMax": 25,
      "ratioMax": 0.3,
      "comision": 2,
      "financia": 0.85,
      "ingresoMin": 1000000,
      "montoMin": 20000000,
      "url": "https://bienvenido.davivienda.cr",
      "garantia": "Hipotecaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula del solicitante y cónyuge",
            "Certificación de estado civil reciente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Tres últimas órdenes patronales",
            "Estados de cuenta de los últimos 6 meses",
            "Para independientes: 2 declaraciones de renta + certificación de CPA"
          ]
        },
        {
          "categoria": "Documentos de la propiedad",
          "items": [
            "Estudio registral del inmueble",
            "Plano catastrado vigente",
            "Avalúo por perito autorizado",
            "Permisos municipales según corresponda"
          ]
        },
        {
          "categoria": "Garantías y pólizas",
          "items": [
            "Hipoteca de primer grado",
            "Póliza de incendio sobre la propiedad",
            "Póliza de saldo deudor (vida)",
            "Demostración sólida de capacidad de pago a largo plazo"
          ]
        }
      ]
    }
  },
  {
    "id": "pro",
    "nombre": "Promerica",
    "color": "#5BA850",
    "iniciales": "PRO",
    "tipo": "Privado",
    "web": "https://www.promerica.fi.cr",
    "verificado": "2026-01-10",
    "personal": {
      "tasaCRC": 18.5,
      "tasaUSD": 13.5,
      "plazoMax": 7,
      "ratioMax": 0.33,
      "comision": 2.5,
      "ingresoMin": 500000,
      "montoMin": 500000,
      "url": "https://www.promerica.fi.cr",
      "garantia": "Fiduciaria o sin garantía",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad vigente",
            "Para extranjeros: cédula de residencia"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial original (menos de 30 días)",
            "Tres últimas órdenes patronales o colillas de pago",
            "Para independientes: declaración de renta + movimientos bancarios"
          ]
        },
        {
          "categoria": "Información laboral",
          "items": [
            "Antigüedad laboral mínima de 6 meses en el empleo actual",
            "Para independientes: actividad económica con al menos 1 año"
          ]
        },
        {
          "categoria": "Garantías",
          "items": [
            "Garantía fiduciaria o sin garantía según monto y perfil",
            "Análisis crediticio con scoring interno y SUGEF"
          ]
        }
      ]
    },
    "vehiculo": {
      "tasaCRC": 11.75,
      "tasaUSD": 9,
      "plazoMax": 7,
      "ratioMax": 0.33,
      "comision": 2.5,
      "financia": 0.85,
      "ingresoMin": 600000,
      "montoMin": 2500000,
      "url": "https://www.promerica.fi.cr",
      "garantia": "Prendaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula vigente del solicitante",
            "Documentación del cónyuge si aplica"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Órdenes patronales recientes",
            "Estados de cuenta bancarios"
          ]
        },
        {
          "categoria": "Documentos del vehículo",
          "items": [
            "Factura proforma del concesionario",
            "Para vehículos usados: certificación registral",
            "Antigüedad máxima del vehículo según política"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Constitución de garantía prendaria",
            "Seguro contra todo riesgo obligatorio",
            "Comisión de formalización del 2.5%"
          ]
        }
      ]
    },
    "hipoteca": {
      "tasaCRC": 8.9,
      "tasaUSD": 8.1,
      "plazoMax": 25,
      "ratioMax": 0.3,
      "comision": 2,
      "financia": 0.85,
      "ingresoMin": 800000,
      "montoMin": 18000000,
      "url": "https://www.promerica.fi.cr",
      "garantia": "Hipotecaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula del solicitante y cónyuge",
            "Estado civil documentado"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Órdenes patronales de los últimos 3 meses",
            "Estados de cuenta de los últimos 6 meses",
            "Para independientes: declaración de renta de 2 períodos"
          ]
        },
        {
          "categoria": "Documentos de la propiedad",
          "items": [
            "Estudio registral actualizado",
            "Plano catastrado vigente",
            "Avalúo por perito autorizado",
            "Certificación municipal de uso de suelo"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Hipoteca de primer grado o fideicomiso",
            "Póliza de incendio + saldo deudor",
            "Comisión de formalización del 2%"
          ]
        }
      ]
    }
  },
  {
    "id": "sci",
    "nombre": "DaviBank",
    "color": "#C8102E",
    "iniciales": "DAVI",
    "tipo": "Privado",
    "web": "https://www.davibank.cr",
    "verificado": "2026-01-08",
    "personal": {
      "tasaCRC": 19.5,
      "tasaUSD": 13.75,
      "plazoMax": 6,
      "ratioMax": 0.32,
      "comision": 2.5,
      "ingresoMin": 600000,
      "montoMin": 700000,
      "url": "https://www.davibank.cr",
      "garantia": "Fiduciaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad vigente",
            "Para extranjeros: cédula de residencia permanente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial reciente (menos de 30 días)",
            "Tres últimas órdenes patronales",
            "Estados de cuenta de los últimos 3 a 6 meses",
            "Para independientes: declaración de renta + movimientos bancarios"
          ]
        },
        {
          "categoria": "Información laboral",
          "items": [
            "Antigüedad laboral mínima en el empleo actual",
            "Cliente preferente DaviBank obtiene condiciones especiales"
          ]
        },
        {
          "categoria": "Garantías",
          "items": [
            "Garantía fiduciaria con fiador solidario",
            "Análisis crediticio con scoring interno y SUGEF"
          ]
        }
      ]
    },
    "vehiculo": {
      "tasaCRC": 12.25,
      "tasaUSD": 9.25,
      "plazoMax": 7,
      "ratioMax": 0.32,
      "comision": 2.5,
      "financia": 0.8,
      "ingresoMin": 650000,
      "montoMin": 3000000,
      "url": "https://www.davibank.cr",
      "garantia": "Prendaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula vigente del solicitante",
            "Documentación del cónyuge si aplica"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Tres últimas órdenes patronales",
            "Estados de cuenta de los últimos 3 meses"
          ]
        },
        {
          "categoria": "Documentos del vehículo",
          "items": [
            "Factura proforma del concesionario o vendedor",
            "Para vehículos usados: certificación registral del vehículo",
            "Antigüedad máxima del vehículo según política vigente"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Constitución de garantía prendaria inscrita",
            "Seguro contra todo riesgo obligatorio durante toda la vigencia",
            "Comisión de formalización del 2.5%"
          ]
        }
      ]
    },
    "hipoteca": {
      "tasaCRC": 9.25,
      "tasaUSD": 8.5,
      "plazoMax": 25,
      "ratioMax": 0.3,
      "comision": 2,
      "financia": 0.8,
      "ingresoMin": 900000,
      "montoMin": 20000000,
      "url": "https://www.davibank.cr",
      "garantia": "Hipotecaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula del solicitante y cónyuge",
            "Certificación de estado civil reciente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Órdenes patronales de los últimos 3 meses",
            "Estados de cuenta de los últimos 6 meses",
            "Para independientes: 2 declaraciones de renta"
          ]
        },
        {
          "categoria": "Documentos de la propiedad",
          "items": [
            "Estudio registral actualizado",
            "Plano catastrado vigente",
            "Avalúo por perito autorizado por DaviBank",
            "Permisos municipales según corresponda"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Hipoteca de primer grado",
            "Póliza de incendio sobre la propiedad",
            "Póliza de saldo deudor obligatoria",
            "Demostración sólida de capacidad de pago"
          ]
        }
      ]
    }
  },
  {
    "id": "lf",
    "nombre": "Lafise",
    "color": "#1B5E20",
    "iniciales": "LAF",
    "tipo": "Privado",
    "web": "https://www.lafise.com",
    "verificado": "2026-01-09",
    "personal": {
      "tasaCRC": 20,
      "tasaUSD": 14.5,
      "plazoMax": 6,
      "ratioMax": 0.3,
      "comision": 3,
      "ingresoMin": 700000,
      "montoMin": 1000000,
      "url": "https://www.lafise.com",
      "garantia": "Fiduciaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula de identidad vigente",
            "Para extranjeros: cédula de residencia permanente vigente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial original (menos de 30 días)",
            "Tres últimas órdenes patronales",
            "Estados de cuenta bancarios de los últimos 6 meses",
            "Para independientes: declaración de renta + estados financieros"
          ]
        },
        {
          "categoria": "Garantías",
          "items": [
            "Garantía fiduciaria con fiador solidario",
            "Análisis con scoring SUGEF"
          ]
        },
        {
          "categoria": "Comisiones",
          "items": [
            "Comisión de formalización del 3% sobre el monto aprobado",
            "Pólizas accesorias según el producto"
          ]
        }
      ]
    },
    "vehiculo": {
      "tasaCRC": 12.5,
      "tasaUSD": 9.5,
      "plazoMax": 6,
      "ratioMax": 0.3,
      "comision": 3,
      "financia": 0.8,
      "ingresoMin": 750000,
      "montoMin": 3500000,
      "url": "https://www.lafise.com",
      "garantia": "Prendaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula vigente del solicitante",
            "Documentación del cónyuge si aplica"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Órdenes patronales recientes",
            "Estados de cuenta bancarios"
          ]
        },
        {
          "categoria": "Documentos del vehículo",
          "items": [
            "Factura proforma del concesionario",
            "Para usados: certificación registral del vehículo",
            "Antigüedad máxima del vehículo limitada según política"
          ]
        },
        {
          "categoria": "Garantías y seguros",
          "items": [
            "Garantía prendaria inscrita ante el Registro Nacional",
            "Seguro contra todo riesgo durante toda la vigencia",
            "Comisión de formalización del 3%"
          ]
        }
      ]
    },
    "hipoteca": {
      "tasaCRC": 9.5,
      "tasaUSD": 8.75,
      "plazoMax": 20,
      "ratioMax": 0.28,
      "comision": 2.5,
      "financia": 0.8,
      "ingresoMin": 1100000,
      "montoMin": 25000000,
      "url": "https://www.lafise.com",
      "garantia": "Hipotecaria",
      "requisitos": [
        {
          "categoria": "Identificación",
          "items": [
            "Cédula del solicitante y cónyuge",
            "Certificación de estado civil reciente"
          ]
        },
        {
          "categoria": "Demostración de ingresos",
          "items": [
            "Constancia salarial vigente",
            "Tres últimas órdenes patronales",
            "Estados de cuenta de los últimos 6 meses",
            "Para independientes: declaración de renta de 2 períodos + estados financieros"
          ]
        },
        {
          "categoria": "Documentos de la propiedad",
          "items": [
            "Estudio registral actualizado",
            "Plano catastrado vigente",
            "Avalúo por perito autorizado",
            "Permisos municipales según corresponda"
          ]
        },
        {
          "categoria": "Garantías y comisiones",
          "items": [
            "Hipoteca de primer grado",
            "Pólizas obligatorias: incendio + saldo deudor",
            "Comisión de formalización del 2.5%",
            "Plazo máximo más conservador del mercado: 20 años"
          ]
        }
      ]
    }
  }
];

const CONFIG_TIPOS = {
  "personal": {
    "plazoMin": 1,
    "plazoDef": 5,
    "prima": false,
    "label": "préstamo personal"
  },
  "vehiculo": {
    "plazoMin": 1,
    "plazoDef": 6,
    "prima": true,
    "primaMax": 30000000,
    "primaDef": 3000000,
    "label": "préstamo de vehículo"
  },
  "hipoteca": {
    "plazoMin": 5,
    "plazoDef": 20,
    "prima": true,
    "primaMax": 80000000,
    "primaDef": 15000000,
    "label": "crédito hipotecario"
  }
};

// Tipo de cambio aproximado (en produccion deberia conectarse a API del BCCR).
const TIPO_CAMBIO_USD = 510;

// Países objetivo de PreCali regional.
// Costa Rica es el mercado activo inicial; los demás quedan visibles mientras se validan fuentes oficiales.
const PAISES = [
  { id: 'cr', nombre: 'Costa Rica', bandera: '🇨🇷', moneda: 'CRC', simbolo: '₡', cambioUSD: 510, estado: 'activo', bancos: 8 },
  { id: 'mx', nombre: 'México', bandera: '🇲🇽', moneda: 'MXN', simbolo: '$', cambioUSD: 17.5, estado: 'activo', bancos: 6 },
  { id: 'gt', nombre: 'Guatemala', bandera: '🇬🇹', moneda: 'GTQ', simbolo: 'Q', cambioUSD: 7.75, estado: 'activo', bancos: 5 },
  { id: 'sv', nombre: 'El Salvador', bandera: '🇸🇻', moneda: 'USD', simbolo: '$', cambioUSD: 1, estado: 'activo', bancos: 6 },
  { id: 'hn', nombre: 'Honduras', bandera: '🇭🇳', moneda: 'HNL', simbolo: 'L', cambioUSD: 25.3, estado: 'activo', bancos: 5 },
  { id: 'ni', nombre: 'Nicaragua', bandera: '🇳🇮', moneda: 'NIO', simbolo: 'C$', cambioUSD: 36.5, estado: 'activo', bancos: 5 },
  { id: 'pa', nombre: 'Panamá', bandera: '🇵🇦', moneda: 'USD/PAB', simbolo: '$', cambioUSD: 1, estado: 'activo', bancos: 5 }
];





const AVISOS_LEGALES = {
  cr: {
    creditos: 'Estimación referencial basada en información pública de bancos y cooperativas supervisadas. La aprobación final, monto y tasa dependen del análisis de cada entidad, historial crediticio, capacidad de pago, garantía y políticas internas. En Costa Rica pueden aplicar consultas al CIC/SUGEF cuando la entidad autorizada evalúe formalmente el crédito.',
    seguros: 'Estimación orientativa basada en información pública del mercado asegurador costarricense. El precio final, deducibles, exclusiones y aceptación los confirma cada aseguradora o intermediario autorizado bajo la supervisión de SUGESE. PreCali no emite pólizas ni sustituye una cotización oficial.',
    privacidad: 'Los datos personales deben tratarse conforme a la Ley 8968 y al consentimiento del usuario; PreCali muestra comparaciones informativas y no constituye una oferta vinculante.'
  },
  mx: {
    creditos: 'Estimación referencial para México basada en información pública. La aprobación final depende de la institución financiera, análisis crediticio, capacidad de pago y, cuando corresponda, consulta a Sociedades de Información Crediticia conforme a la regulación aplicable.',
    seguros: 'Estimación orientativa basada en información pública de aseguradoras y referencias de mercado. La prima exacta, coberturas, deducibles y exclusiones las confirma la aseguradora autorizada por CNSF; CONDUSEF es la autoridad de atención y defensa del usuario financiero.',
    privacidad: 'El tratamiento de datos personales requiere consentimiento y debe atender la legislación mexicana de protección de datos; PreCali no es una institución financiera ni aseguradora.'
  },
  gt: {
    creditos: 'Estimación referencial para Guatemala. La aprobación final depende de la entidad financiera, políticas internas, capacidad de pago y reportes crediticios autorizados cuando apliquen. La supervisión del sistema financiero corresponde a la SIB.',
    seguros: 'Estimación orientativa para Guatemala con información pública y rangos de mercado. La prima final, condiciones, deducibles y exclusiones los define la aseguradora autorizada y supervisada por la SIB.',
    privacidad: 'El usuario debe autorizar cualquier tratamiento o verificación de datos. PreCali informa y compara; no otorga crédito ni emite pólizas.'
  },
  sv: {
    creditos: 'Estimación referencial para El Salvador. La aprobación final depende de bancos o entidades financieras supervisadas por la SSF, su política de riesgo, capacidad de pago y validaciones crediticias autorizadas.',
    seguros: 'Estimación orientativa en USD para El Salvador. Las condiciones finales, prima, exclusiones y aceptación las confirma cada aseguradora autorizada y supervisada por la SSF.',
    privacidad: 'Cualquier consulta o envío de datos requiere autorización del usuario. PreCali no representa aprobación, oferta vinculante ni intermediación de seguros.'
  },
  hn: {
    creditos: 'Estimación referencial para Honduras. La aprobación final depende de la entidad financiera, capacidad de pago, historial y políticas internas bajo el marco de supervisión de la CNBS.',
    seguros: 'Estimación orientativa para Honduras basada en rangos públicos de mercado. La prima final y las condiciones contractuales las determina la aseguradora autorizada bajo supervisión de la CNBS.',
    privacidad: 'El usuario debe autorizar el uso de sus datos. PreCali funciona como comparador informativo y no como banco, aseguradora o corredor.'
  },
  ni: {
    creditos: 'Estimación referencial para Nicaragua. La aprobación formal depende de la entidad financiera, capacidad de pago, historial y políticas internas bajo el marco de supervisión de SIBOIF cuando aplique.',
    seguros: 'Estimación orientativa para Nicaragua. El precio final, coberturas, deducibles y exclusiones los confirma cada aseguradora autorizada en el mercado local.',
    privacidad: 'PreCali requiere consentimiento para tratar datos del usuario y no constituye oferta vinculante, aprobación de crédito ni emisión de póliza.'
  },
  pa: {
    creditos: 'Estimación referencial para Panamá. La aprobación final depende del banco o entidad financiera, su análisis de riesgo, capacidad de pago e información crediticia autorizada bajo el marco regulatorio aplicable.',
    seguros: 'Estimación orientativa en USD/PAB para Panamá. La prima exacta, coberturas y exclusiones las confirma cada aseguradora autorizada y supervisada por la Superintendencia de Seguros y Reaseguros de Panamá.',
    privacidad: 'El tratamiento de datos personales debe atender el consentimiento del usuario y la Ley 81 de protección de datos personales. PreCali no es oferta vinculante.'
  }
};

// Datos de bancos costarricenses
// Fuente: sitios oficiales de cada banco, vigentes a enero 2026
// Para actualizar: revisar URLs oficiales y modificar tasas/plazos según corresponda

const BANCOS = [
  {
    id: 'bn',
    nombre: 'Banco Nacional',
    color: '#005CAB',
    iniciales: 'BN',
    tipo: 'Público',
    web: 'https://www.bncr.fi.cr',
    verificado: '2026-01-15',
    personal: {
      tasaCRC: 16.5, tasaUSD: 12.0, plazoMax: 8, ratioMax: 0.40,
      comision: 2.5, ingresoMin: 350000, montoMin: 500000,
      url: 'https://www.bncr.fi.cr/personas/financiamiento/calculadora-de-credito',
      garantia: 'Fiduciaria o sin garantía según monto',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad costarricense vigente y en buen estado',
          'Para extranjeros: cédula de residencia permanente vigente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial original con menos de 30 días de emisión',
          'Tres últimas órdenes patronales o colillas de pago',
          'Para independientes: declaración del impuesto sobre la renta del último período fiscal',
          'Para independientes: estados de cuenta bancarios de los últimos 6 meses'
        ]},
        { categoria: 'Información laboral', items: [
          'Antigüedad laboral mínima de 6 meses en el empleo actual',
          'Constancia de la CCSS de aseguramiento'
        ]},
        { categoria: 'Información financiera', items: [
          'Carta de SUGEF (Centro de Información Crediticia)',
          'Detalle de deudas vigentes y referencias crediticias'
        ]}
      ]
    },
    vehiculo: {
      tasaCRC: 11.5, tasaUSD: 8.5, plazoMax: 8, ratioMax: 0.40,
      comision: 2.0, financia: 0.85, ingresoMin: 400000, montoMin: 2000000,
      url: 'https://www.bncr.fi.cr/personas/financiamiento/calculadora-de-credito',
      garantia: 'Prendaria sobre el vehículo',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad costarricense vigente',
          'Cédula del cónyuge si aplica (para vehículos en bienes gananciales)'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Tres últimas órdenes patronales',
          'Para independientes: declaración de renta y estados bancarios de 6 meses'
        ]},
        { categoria: 'Documentos del vehículo', items: [
          'Factura proforma del concesionario o vendedor',
          'Para usados: certificación registral del vehículo (RNP)',
          'Antigüedad máxima del vehículo: 7 años al momento de la solicitud'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Constitución de garantía prendaria sobre el vehículo',
          'Póliza de seguro contra todo riesgo (obligatoria durante toda la vigencia)',
          'Avalúo cuando aplique'
        ]}
      ]
    },
    hipoteca: {
      tasaCRC: 8.5, tasaUSD: 7.75, plazoMax: 30, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 600000, montoMin: 15000000,
      url: 'https://www.bncr.fi.cr/personas/financiamiento/calculadora-de-credito/calculadora-vivienda',
      garantia: 'Hipotecaria o fideicomiso',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad vigente del solicitante y cónyuge',
          'Constancia de estado civil reciente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial original (menos de 30 días)',
          'Órdenes patronales de los últimos 3 meses',
          'Estados de cuenta bancarios de los últimos 6 meses',
          'Para independientes: 2 últimas declaraciones de renta'
        ]},
        { categoria: 'Documentos de la propiedad', items: [
          'Estudio registral actualizado (menos de 30 días)',
          'Plano catastrado vigente',
          'Avalúo realizado por perito autorizado por el banco',
          'Certificación de la municipalidad sobre uso de suelo'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Constitución de hipoteca de primer grado o fideicomiso',
          'Póliza de incendio sobre la propiedad',
          'Póliza de saldo deudor (vida del deudor)'
        ]}
      ]
    }
  },
  {
    id: 'bcr',
    nombre: 'Banco de Costa Rica',
    color: '#004FA3',
    iniciales: 'BCR',
    tipo: 'Público',
    web: 'https://www.bancobcr.com',
    verificado: '2026-01-15',
    personal: {
      tasaCRC: 17.0, tasaUSD: 12.5, plazoMax: 8, ratioMax: 0.38,
      comision: 3.0, ingresoMin: 400000, montoMin: 500000,
      url: 'https://www.bancobcr.com/wps/portal/bcr/bancobcr/personas/prestamos/personal-consumo',
      garantia: 'Fiduciaria, fideicomiso o back-to-back',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad vigente',
          'Para extranjeros: cédula de residencia permanente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial reciente con menos de 30 días',
          'Tres últimas colillas de pago u órdenes patronales',
          'Estados de cuenta bancarios de los últimos 3 a 6 meses',
          'Para independientes: declaración del impuesto sobre la renta'
        ]},
        { categoria: 'Análisis crediticio', items: [
          'Análisis con scoring SUGEF (Centro de Información Crediticia)',
          'Historial crediticio sin atrasos significativos en últimos 12 meses',
          'Comisión de formalización del 3% sobre el monto aprobado'
        ]},
        { categoria: 'Garantías', items: [
          'Fiador solidario para montos mayores',
          'Opción de fideicomiso de garantía o back-to-back con depósitos a plazo'
        ]}
      ]
    },
    vehiculo: {
      tasaCRC: 12.0, tasaUSD: 9.0, plazoMax: 7, ratioMax: 0.38,
      comision: 2.5, financia: 0.85, ingresoMin: 450000, montoMin: 2000000,
      url: 'https://www.bancobcr.com/wps/portal/bcr/bancobcr/personas/prestamos',
      garantia: 'Prendaria sobre el vehículo',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula vigente del solicitante',
          'Estado civil documentado'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Tres últimas órdenes patronales',
          'Para independientes: dos últimas declaraciones de renta'
        ]},
        { categoria: 'Documentos del vehículo', items: [
          'Factura proforma del concesionario',
          'Para vehículo usado: certificación registral del vehículo',
          'Antigüedad máxima según política vigente del banco'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Garantía prendaria inscrita ante el Registro Nacional',
          'Póliza de seguro contra todo riesgo durante toda la vigencia',
          'Comisión de formalización del 2.5%'
        ]}
      ]
    },
    hipoteca: {
      tasaCRC: 8.75, tasaUSD: 8.0, plazoMax: 30, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 700000, montoMin: 15000000,
      url: 'https://www.bancobcr.com/wps/portal/bcr/bancobcr/personas/prestamos/vivienda-mi-casa',
      garantia: 'Hipoteca, hipoteca abierta o fideicomiso',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula del solicitante y cónyuge',
          'Certificación de estado civil reciente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Órdenes patronales de los últimos 3 meses',
          'Estados de cuenta bancarios de los últimos 6 meses',
          'Para independientes: 2 declaraciones de renta + certificación de contador público'
        ]},
        { categoria: 'Documentos de la propiedad', items: [
          'Estudio registral actualizado',
          'Plano catastrado original',
          'Avalúo financiable realizado por perito autorizado',
          'Permisos de construcción si aplica'
        ]},
        { categoria: 'Comisiones y garantías', items: [
          'Comisión 2% en colones, hasta 3.5% en dólares (riesgo cambiario)',
          'Hipoteca de primer grado o fideicomiso de garantía',
          'Pólizas obligatorias: incendio + saldo deudor'
        ]}
      ]
    }
  },
  {
    id: 'bac',
    nombre: 'BAC Credomatic',
    color: '#E30613',
    iniciales: 'BAC',
    tipo: 'Privado',
    web: 'https://www.baccredomatic.com/es-cr',
    verificado: '2026-01-20',
    personal: {
      tasaCRC: 24.0, tasaUSD: 13.5, plazoMax: 5, ratioMax: 0.35,
      comision: 0, ingresoMin: 500000, montoMin: 500000,
      url: 'https://www.baccredomatic.com/es-cr/personas/prestamos/personales',
      garantia: 'Vinculado a tarjeta de crédito BAC',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad vigente',
          'Para extranjeros: cédula de residencia',
          'Comprobante de domicilio reciente (recibo de servicios)'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial reciente',
          'Para asalariados: tres últimas órdenes patronales',
          'Para independientes: estados financieros y declaración de renta',
          'Estados de cuenta bancarios de los últimos 3 meses'
        ]},
        { categoria: 'Condiciones especiales', items: [
          'Plazo máximo de 60 meses (5 años)',
          'Tasas referenciales entre 22% y 28% en colones según perfil',
          'Sin comisión de desembolso',
          'Cancelación anticipada sin penalidad',
          'Cliente preferente con tarjeta BAC obtiene mejores condiciones'
        ]}
      ]
    },
    vehiculo: {
      tasaCRC: 10.9, tasaUSD: 8.25, plazoMax: 8, ratioMax: 0.35,
      comision: 2.0, financia: 0.85, ingresoMin: 600000, montoMin: 3000000,
      url: 'https://www.baccredomatic.com/es-cr/personas/prestamos',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula vigente del solicitante',
          'Estado civil documentado'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Órdenes patronales de los últimos 3 meses',
          'Estados de cuenta de los últimos 3 a 6 meses'
        ]},
        { categoria: 'Documentos del vehículo', items: [
          'Factura proforma del concesionario o vendedor',
          'Para vehículos usados: revisión técnica al día',
          'Certificación registral del vehículo (RNP)'
        ]},
        { categoria: 'Seguros obligatorios', items: [
          'Seguro de saldo deudor obligatorio',
          'Seguro contra todo riesgo del vehículo durante toda la vigencia',
          'Constitución de prenda inscrita ante el Registro Nacional'
        ]}
      ]
    },
    hipoteca: {
      tasaCRC: 8.0, tasaUSD: 7.25, plazoMax: 30, ratioMax: 0.32,
      comision: 2.0, financia: 0.80, ingresoMin: 900000, montoMin: 25000000,
      url: 'https://www.baccredomatic.com/es-cr/personas/prestamos/hipotecarios',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula del solicitante y cónyuge',
          'Certificación de estado civil'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial reciente',
          'Tres últimas órdenes patronales',
          'Estados de cuenta de los últimos 6 meses',
          'Para independientes: declaraciones de renta de últimos 2 períodos'
        ]},
        { categoria: 'Documentos de la propiedad', items: [
          'Estudio registral del inmueble',
          'Plano catastrado vigente',
          'Avalúo realizado por perito autorizado por BAC',
          'Permisos municipales según corresponda'
        ]},
        { categoria: 'Estructura tarifaria especial', items: [
          'Tasa escalonada en USD: 7.25% año 1, 8.35% año 2, luego SOFR + 4.90%',
          'Monto mínimo en USD: $10,000',
          'Pólizas de incendio + saldo deudor obligatorias',
          'Hipoteca de primer grado'
        ]}
      ]
    }
  },
  {
    id: 'pop',
    nombre: 'Banco Popular',
    color: '#F58220',
    iniciales: 'POP',
    tipo: 'Público',
    web: 'https://www.bancopopular.fi.cr',
    verificado: '2026-01-18',
    personal: {
      tasaCRC: 15.5, tasaUSD: 11.5, plazoMax: 9, ratioMax: 0.40,
      comision: 2.0, ingresoMin: 300000, montoMin: 300000,
      url: 'https://www.bancopopular.fi.cr/crediton/',
      garantia: 'Sin fiador (Creditón)',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad vigente',
          'Para extranjeros: cédula de residencia permanente o temporal vigente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial original',
          'Tres últimas órdenes patronales',
          'Para independientes: declaración del impuesto sobre la renta + estados bancarios'
        ]},
        { categoria: 'Beneficios para afiliados', items: [
          'Mejores tasas para afiliados al Banco Popular',
          'Hasta 108 meses (9 años) de plazo máximo',
          'Pólizas de vida y desempleo incluidas en el crédito',
          'Sin necesidad de fiador (modalidad Creditón)'
        ]},
        { categoria: 'Análisis crediticio', items: [
          'Consulta al Centro de Información Crediticia (SUGEF)',
          'Antigüedad laboral mínima requerida'
        ]}
      ]
    },
    vehiculo: {
      tasaCRC: 11.0, tasaUSD: 8.5, plazoMax: 8, ratioMax: 0.40,
      comision: 2.0, financia: 0.90, ingresoMin: 400000, montoMin: 2000000,
      url: 'https://www.bancopopular.fi.cr/',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula vigente del solicitante',
          'Documentación del cónyuge si aplica'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Órdenes patronales recientes',
          'Para independientes: declaraciones de renta y movimientos bancarios'
        ]},
        { categoria: 'Documentos del vehículo', items: [
          'Factura proforma del concesionario',
          'Para usados: certificación registral del Registro Nacional',
          'Financiamiento hasta el 90% del valor del vehículo'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Constitución de garantía prendaria',
          'Seguro contra todo riesgo durante toda la vigencia del crédito',
          'Pólizas accesorias incluidas'
        ]}
      ]
    },
    hipoteca: {
      tasaCRC: 8.25, tasaUSD: 7.5, plazoMax: 30, ratioMax: 0.35,
      comision: 1.5, financia: 0.95, ingresoMin: 550000, montoMin: 12000000,
      url: 'https://www.bancopopular.fi.cr/',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula vigente del solicitante y cónyuge',
          'Certificación de estado civil'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial reciente',
          'Órdenes patronales de los últimos 3 meses',
          'Estados de cuenta bancarios de 6 meses'
        ]},
        { categoria: 'Documentos de la propiedad', items: [
          'Estudio registral actualizado',
          'Plano catastrado vigente',
          'Avalúo del inmueble por perito autorizado',
          'Para construcción: permisos municipales y cronograma de obra'
        ]},
        { categoria: 'Programa FEVI y comisiones', items: [
          'Programa FEVI permite hasta 100% de financiamiento en casos especiales',
          'Comisión de formalización 1.5% (una de las más bajas del mercado)',
          'Pólizas de incendio + saldo deudor obligatorias'
        ]}
      ]
    }
  },
  {
    id: 'dav',
    nombre: 'Davivienda',
    color: '#ED1C27',
    iniciales: 'DAV',
    tipo: 'Privado',
    web: 'https://bienvenido.davivienda.cr',
    verificado: '2026-01-12',
    personal: {
      tasaCRC: 19.0, tasaUSD: 14.0, plazoMax: 7, ratioMax: 0.33,
      comision: 2.5, ingresoMin: 600000, montoMin: 750000,
      url: 'https://bienvenido.davivienda.cr',
      garantia: 'Sin garantía',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad vigente',
          'Para extranjeros: cédula de residencia permanente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial reciente',
          'Tres últimas órdenes patronales',
          'Estados de cuenta de los últimos 3 meses',
          'Para independientes: declaración de renta + estados bancarios de 6 meses'
        ]},
        { categoria: 'Características del producto', items: [
          'Tasa variable: TBP (Tasa Básica Pasiva) + margen fijo',
          'Cálculo de cuotas con base 360 días',
          'Sin necesidad de garantía real',
          'Análisis con scoring crediticio interno'
        ]}
      ]
    },
    vehiculo: {
      tasaCRC: 12.5, tasaUSD: 9.5, plazoMax: 7, ratioMax: 0.33,
      comision: 2.5, financia: 0.80, ingresoMin: 700000, montoMin: 3000000,
      url: 'https://bienvenido.davivienda.cr',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula vigente del solicitante',
          'Documentación del cónyuge si el vehículo es ganancial'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Órdenes patronales recientes',
          'Estados de cuenta de los últimos 3 meses'
        ]},
        { categoria: 'Documentos del vehículo', items: [
          'Factura proforma del concesionario',
          'Para usados: certificación registral del vehículo',
          'Antigüedad máxima del vehículo según política vigente'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Garantía prendaria inscrita',
          'Seguro contra todo riesgo obligatorio',
          'Comisión de formalización del 2.5%'
        ]}
      ]
    },
    hipoteca: {
      tasaCRC: 9.0, tasaUSD: 8.25, plazoMax: 25, ratioMax: 0.30,
      comision: 2.0, financia: 0.85, ingresoMin: 1000000, montoMin: 20000000,
      url: 'https://bienvenido.davivienda.cr',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula del solicitante y cónyuge',
          'Certificación de estado civil reciente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Tres últimas órdenes patronales',
          'Estados de cuenta de los últimos 6 meses',
          'Para independientes: 2 declaraciones de renta + certificación de CPA'
        ]},
        { categoria: 'Documentos de la propiedad', items: [
          'Estudio registral del inmueble',
          'Plano catastrado vigente',
          'Avalúo por perito autorizado',
          'Permisos municipales según corresponda'
        ]},
        { categoria: 'Garantías y pólizas', items: [
          'Hipoteca de primer grado',
          'Póliza de incendio sobre la propiedad',
          'Póliza de saldo deudor (vida)',
          'Demostración sólida de capacidad de pago a largo plazo'
        ]}
      ]
    }
  },
  {
    id: 'pro',
    nombre: 'Promerica',
    color: '#5BA850',
    iniciales: 'PRO',
    tipo: 'Privado',
    web: 'https://www.promerica.fi.cr',
    verificado: '2026-01-10',
    personal: {
      tasaCRC: 18.5, tasaUSD: 13.5, plazoMax: 7, ratioMax: 0.33,
      comision: 2.5, ingresoMin: 500000, montoMin: 500000,
      url: 'https://www.promerica.fi.cr',
      garantia: 'Fiduciaria o sin garantía',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad vigente',
          'Para extranjeros: cédula de residencia'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial original (menos de 30 días)',
          'Tres últimas órdenes patronales o colillas de pago',
          'Para independientes: declaración de renta + movimientos bancarios'
        ]},
        { categoria: 'Información laboral', items: [
          'Antigüedad laboral mínima de 6 meses en el empleo actual',
          'Para independientes: actividad económica con al menos 1 año'
        ]},
        { categoria: 'Garantías', items: [
          'Garantía fiduciaria o sin garantía según monto y perfil',
          'Análisis crediticio con scoring interno y SUGEF'
        ]}
      ]
    },
    vehiculo: {
      tasaCRC: 11.75, tasaUSD: 9.0, plazoMax: 7, ratioMax: 0.33,
      comision: 2.5, financia: 0.85, ingresoMin: 600000, montoMin: 2500000,
      url: 'https://www.promerica.fi.cr',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula vigente del solicitante',
          'Documentación del cónyuge si aplica'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Órdenes patronales recientes',
          'Estados de cuenta bancarios'
        ]},
        { categoria: 'Documentos del vehículo', items: [
          'Factura proforma del concesionario',
          'Para vehículos usados: certificación registral',
          'Antigüedad máxima del vehículo según política'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Constitución de garantía prendaria',
          'Seguro contra todo riesgo obligatorio',
          'Comisión de formalización del 2.5%'
        ]}
      ]
    },
    hipoteca: {
      tasaCRC: 8.9, tasaUSD: 8.1, plazoMax: 25, ratioMax: 0.30,
      comision: 2.0, financia: 0.85, ingresoMin: 800000, montoMin: 18000000,
      url: 'https://www.promerica.fi.cr',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula del solicitante y cónyuge',
          'Estado civil documentado'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Órdenes patronales de los últimos 3 meses',
          'Estados de cuenta de los últimos 6 meses',
          'Para independientes: declaración de renta de 2 períodos'
        ]},
        { categoria: 'Documentos de la propiedad', items: [
          'Estudio registral actualizado',
          'Plano catastrado vigente',
          'Avalúo por perito autorizado',
          'Certificación municipal de uso de suelo'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Hipoteca de primer grado o fideicomiso',
          'Póliza de incendio + saldo deudor',
          'Comisión de formalización del 2%'
        ]}
      ]
    }
  },
  {
    id: 'sci',
    nombre: 'DaviBank',
    color: '#C8102E',
    iniciales: 'DAVI',
    tipo: 'Privado',
    web: 'https://www.davibank.cr',
    verificado: '2026-01-08',
    personal: {
      tasaCRC: 19.5, tasaUSD: 13.75, plazoMax: 6, ratioMax: 0.32,
      comision: 2.5, ingresoMin: 600000, montoMin: 700000,
      url: 'https://www.davibank.cr',
      garantia: 'Fiduciaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad vigente',
          'Para extranjeros: cédula de residencia permanente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial reciente (menos de 30 días)',
          'Tres últimas órdenes patronales',
          'Estados de cuenta de los últimos 3 a 6 meses',
          'Para independientes: declaración de renta + movimientos bancarios'
        ]},
        { categoria: 'Información laboral', items: [
          'Antigüedad laboral mínima en el empleo actual',
          'Cliente preferente DaviBank obtiene condiciones especiales'
        ]},
        { categoria: 'Garantías', items: [
          'Garantía fiduciaria con fiador solidario',
          'Análisis crediticio con scoring interno y SUGEF'
        ]}
      ]
    },
    vehiculo: {
      tasaCRC: 12.25, tasaUSD: 9.25, plazoMax: 7, ratioMax: 0.32,
      comision: 2.5, financia: 0.80, ingresoMin: 650000, montoMin: 3000000,
      url: 'https://www.davibank.cr',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula vigente del solicitante',
          'Documentación del cónyuge si aplica'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Tres últimas órdenes patronales',
          'Estados de cuenta de los últimos 3 meses'
        ]},
        { categoria: 'Documentos del vehículo', items: [
          'Factura proforma del concesionario o vendedor',
          'Para vehículos usados: certificación registral del vehículo',
          'Antigüedad máxima del vehículo según política vigente'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Constitución de garantía prendaria inscrita',
          'Seguro contra todo riesgo obligatorio durante toda la vigencia',
          'Comisión de formalización del 2.5%'
        ]}
      ]
    },
    hipoteca: {
      tasaCRC: 9.25, tasaUSD: 8.5, plazoMax: 25, ratioMax: 0.30,
      comision: 2.0, financia: 0.80, ingresoMin: 900000, montoMin: 20000000,
      url: 'https://www.davibank.cr',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula del solicitante y cónyuge',
          'Certificación de estado civil reciente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Órdenes patronales de los últimos 3 meses',
          'Estados de cuenta de los últimos 6 meses',
          'Para independientes: 2 declaraciones de renta'
        ]},
        { categoria: 'Documentos de la propiedad', items: [
          'Estudio registral actualizado',
          'Plano catastrado vigente',
          'Avalúo por perito autorizado por DaviBank',
          'Permisos municipales según corresponda'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Hipoteca de primer grado',
          'Póliza de incendio sobre la propiedad',
          'Póliza de saldo deudor obligatoria',
          'Demostración sólida de capacidad de pago'
        ]}
      ]
    }
  },
  {
    id: 'lf',
    nombre: 'Lafise',
    color: '#1B5E20',
    iniciales: 'LAF',
    tipo: 'Privado',
    web: 'https://www.lafise.com',
    verificado: '2026-01-09',
    personal: {
      tasaCRC: 20.0, tasaUSD: 14.5, plazoMax: 6, ratioMax: 0.30,
      comision: 3.0, ingresoMin: 700000, montoMin: 1000000,
      url: 'https://www.lafise.com',
      garantia: 'Fiduciaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula de identidad vigente',
          'Para extranjeros: cédula de residencia permanente vigente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial original (menos de 30 días)',
          'Tres últimas órdenes patronales',
          'Estados de cuenta bancarios de los últimos 6 meses',
          'Para independientes: declaración de renta + estados financieros'
        ]},
        { categoria: 'Garantías', items: [
          'Garantía fiduciaria con fiador solidario',
          'Análisis con scoring SUGEF'
        ]},
        { categoria: 'Comisiones', items: [
          'Comisión de formalización del 3% sobre el monto aprobado',
          'Pólizas accesorias según el producto'
        ]}
      ]
    },
    vehiculo: {
      tasaCRC: 12.5, tasaUSD: 9.5, plazoMax: 6, ratioMax: 0.30,
      comision: 3.0, financia: 0.80, ingresoMin: 750000, montoMin: 3500000,
      url: 'https://www.lafise.com',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula vigente del solicitante',
          'Documentación del cónyuge si aplica'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Órdenes patronales recientes',
          'Estados de cuenta bancarios'
        ]},
        { categoria: 'Documentos del vehículo', items: [
          'Factura proforma del concesionario',
          'Para usados: certificación registral del vehículo',
          'Antigüedad máxima del vehículo limitada según política'
        ]},
        { categoria: 'Garantías y seguros', items: [
          'Garantía prendaria inscrita ante el Registro Nacional',
          'Seguro contra todo riesgo durante toda la vigencia',
          'Comisión de formalización del 3%'
        ]}
      ]
    },
    hipoteca: {
      tasaCRC: 9.5, tasaUSD: 8.75, plazoMax: 20, ratioMax: 0.28,
      comision: 2.5, financia: 0.80, ingresoMin: 1100000, montoMin: 25000000,
      url: 'https://www.lafise.com',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificación', items: [
          'Cédula del solicitante y cónyuge',
          'Certificación de estado civil reciente'
        ]},
        { categoria: 'Demostración de ingresos', items: [
          'Constancia salarial vigente',
          'Tres últimas órdenes patronales',
          'Estados de cuenta de los últimos 6 meses',
          'Para independientes: declaración de renta de 2 períodos + estados financieros'
        ]},
        { categoria: 'Documentos de la propiedad', items: [
          'Estudio registral actualizado',
          'Plano catastrado vigente',
          'Avalúo por perito autorizado',
          'Permisos municipales según corresponda'
        ]},
        { categoria: 'Garantías y comisiones', items: [
          'Hipoteca de primer grado',
          'Pólizas obligatorias: incendio + saldo deudor',
          'Comisión de formalización del 2.5%',
          'Plazo máximo más conservador del mercado: 20 años'
        ]}
      ]
    }
  },
  {
    id: 'pa_bg',
    pais: 'pa',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'Banco General',
    color: '#006341',
    iniciales: 'BG',
    tipo: 'Privado',
    web: 'https://www.bgeneral.com/personas/',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 12.0, tasaUSD: 12.0, plazoMax: 5, ratioMax: 0.35,
      comision: 2.0, ingresoMin: 800, montoMin: 1000,
      url: 'https://www.bgeneral.com/personas/',
      garantia: 'Segun analisis crediticio',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente', 'Comprobante de domicilio si aplica'] },
        { categoria: 'Demostracion de ingresos', items: ['Carta de trabajo o comprobante de ingresos', 'Ficha de seguro social o talonarios recientes', 'Estados de cuenta bancarios'] },
        { categoria: 'Analisis crediticio', items: ['Historial crediticio vigente', 'Relacion deuda/ingreso dentro de politica del banco'] }
      ]
    },
    vehiculo: {
      tasaCRC: 8.5, tasaUSD: 8.5, plazoMax: 6, ratioMax: 0.35,
      comision: 2.0, financia: 0.95, ingresoMin: 900, montoMin: 5000,
      url: 'https://www.bgeneral.com/personas/',
      garantia: 'Prendaria sobre el vehiculo',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente', 'Licencia o datos del solicitante segun politica'] },
        { categoria: 'Demostracion de ingresos', items: ['Carta de trabajo o comprobante de ingresos', 'Ficha de seguro social o talonarios recientes', 'Estados de cuenta bancarios'] },
        { categoria: 'Vehiculo', items: ['Cotizacion o factura proforma', 'Seguro vehicular requerido durante la vigencia', 'Para usados: revision y antiguedad segun politica'] }
      ]
    },
    hipoteca: {
      tasaCRC: 7.0, tasaUSD: 7.0, plazoMax: 30, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 1200, montoMin: 25000,
      url: 'https://www.bgeneral.com/personas/',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente del solicitante y codeudor si aplica'] },
        { categoria: 'Demostracion de ingresos', items: ['Carta de trabajo o comprobante de ingresos', 'Estados de cuenta', 'Declaracion de renta si aplica'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo de la propiedad', 'Estudio registral o documentos equivalentes'] }
      ]
    }
  },
  {
    id: 'pa_bac',
    pais: 'pa',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'BAC Credomatic Panama',
    color: '#E30613',
    iniciales: 'BAC',
    tipo: 'Privado',
    web: 'https://www.baccredomatic.com/es-pa/personas/prestamos',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 13.0, tasaUSD: 13.0, plazoMax: 5, ratioMax: 0.35,
      comision: 2.0, ingresoMin: 800, montoMin: 1000,
      url: 'https://www.baccredomatic.com/es-pa/personas/prestamos',
      garantia: 'Segun producto y scoring',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante salarial o ingresos verificables', 'Estados de cuenta recientes'] },
        { categoria: 'Analisis crediticio', items: ['Revision de historial crediticio', 'Aprobacion sujeta a politica del banco'] }
      ]
    },
    vehiculo: {
      tasaCRC: 9.0, tasaUSD: 9.0, plazoMax: 6, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 900, montoMin: 5000,
      url: 'https://www.baccredomatic.com/es-pa/personas/prestamos',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante salarial o ingresos verificables', 'Estados de cuenta recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion del vehiculo', 'Seguro vehicular', 'Aprobacion sujeta a avaluo o revision si es usado'] }
      ]
    },
    hipoteca: {
      tasaCRC: 6.75, tasaUSD: 6.75, plazoMax: 30, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 1200, montoMin: 25000,
      url: 'https://www.baccredomatic.com/es-pa/personas/prestamos',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante salarial o ingresos verificables', 'Estados de cuenta recientes'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral de la propiedad'] }
      ]
    }
  },
  {
    id: 'pa_bnp',
    pais: 'pa',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'Banco Nacional de Panama',
    color: '#003C71',
    iniciales: 'BNP',
    tipo: 'Publico',
    web: 'https://www.banconal.com.pa',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 10.5, tasaUSD: 10.5, plazoMax: 6, ratioMax: 0.35,
      comision: 2.0, ingresoMin: 700, montoMin: 1000,
      url: 'https://www.banconal.com.pa',
      garantia: 'Segun producto',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Carta de trabajo o comprobante de ingresos', 'Ficha de seguro social o talonarios recientes'] },
        { categoria: 'Analisis crediticio', items: ['Revision de referencias e historial crediticio'] }
      ]
    },
    vehiculo: {
      tasaCRC: 8.5, tasaUSD: 8.5, plazoMax: 6, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 850, montoMin: 5000,
      url: 'https://www.banconal.com.pa',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Carta de trabajo o comprobante de ingresos', 'Ficha de seguro social o talonarios recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion o factura proforma', 'Seguro vehicular', 'Condiciones finales sujetas a evaluacion'] }
      ]
    },
    hipoteca: {
      tasaCRC: 6.5, tasaUSD: 6.5, plazoMax: 30, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 1000, montoMin: 25000,
      url: 'https://www.banconal.com.pa',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Carta de trabajo o comprobante de ingresos', 'Estados de cuenta'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral'] }
      ]
    }
  },
  {
    id: 'pa_caja',
    pais: 'pa',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'Caja de Ahorros',
    color: '#0071BC',
    iniciales: 'CA',
    tipo: 'Publico',
    web: 'https://www.cajadeahorros.com.pa',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 11.0, tasaUSD: 11.0, plazoMax: 6, ratioMax: 0.35,
      comision: 2.0, ingresoMin: 700, montoMin: 1000,
      url: 'https://www.cajadeahorros.com.pa',
      garantia: 'Segun producto',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Carta de trabajo o comprobante de ingresos', 'Ficha de seguro social o talonarios recientes'] },
        { categoria: 'Analisis crediticio', items: ['Aprobacion sujeta a politica del banco'] }
      ]
    },
    vehiculo: {
      tasaCRC: 8.75, tasaUSD: 8.75, plazoMax: 6, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 850, montoMin: 5000,
      url: 'https://www.cajadeahorros.com.pa',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Carta de trabajo o comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion del vehiculo', 'Seguro vehicular', 'Revision segun politica para usados'] }
      ]
    },
    hipoteca: {
      tasaCRC: 6.75, tasaUSD: 6.75, plazoMax: 30, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 1000, montoMin: 25000,
      url: 'https://www.cajadeahorros.com.pa',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Carta de trabajo o comprobante de ingresos', 'Estados de cuenta'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral'] }
      ]
    }
  },
  {
    id: 'pa_global',
    pais: 'pa',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'Global Bank',
    color: '#002B5C',
    iniciales: 'GB',
    tipo: 'Privado',
    web: 'https://www.globalbank.com.pa/personas/prestamos',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 11.5, tasaUSD: 11.5, plazoMax: 5, ratioMax: 0.35,
      comision: 2.0, ingresoMin: 800, montoMin: 1000,
      url: 'https://www.globalbank.com.pa/personas/prestamos',
      garantia: 'Segun producto',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Analisis crediticio', items: ['Aprobacion sujeta a politica crediticia'] }
      ]
    },
    vehiculo: {
      tasaCRC: 8.5, tasaUSD: 8.5, plazoMax: 6, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 900, montoMin: 5000,
      url: 'https://www.globalbank.com.pa/personas/prestamos',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion del vehiculo', 'Seguro vehicular', 'Condiciones finales sujetas a evaluacion'] }
      ]
    },
    hipoteca: {
      tasaCRC: 7.0, tasaUSD: 7.0, plazoMax: 30, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 1200, montoMin: 25000,
      url: 'https://www.globalbank.com.pa/personas/prestamos',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral'] }
      ]
    }
  },
  {
    id: 'sv_agricola',
    pais: 'sv',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'Banco Agricola',
    color: '#005EB8',
    iniciales: 'BA',
    tipo: 'Privado',
    web: 'https://www.bancoagricola.com/productos/prestamos/',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 13.5, tasaUSD: 13.5, plazoMax: 5, ratioMax: 0.35,
      comision: 2.5, ingresoMin: 600, montoMin: 1000,
      url: 'https://www.bancoagricola.com/productos/prestamos/',
      garantia: 'Segun analisis crediticio',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente', 'NIT o datos fiscales cuando aplique'] },
        { categoria: 'Demostracion de ingresos', items: ['Constancia salarial o comprobante de ingresos', 'Estados de cuenta recientes', 'Historial laboral verificable'] },
        { categoria: 'Analisis crediticio', items: ['Revision de historial crediticio', 'Relacion deuda/ingreso dentro de politica del banco'] }
      ]
    },
    vehiculo: {
      tasaCRC: 10.0, tasaUSD: 10.0, plazoMax: 6, ratioMax: 0.35,
      comision: 2.5, financia: 0.90, ingresoMin: 700, montoMin: 4000,
      url: 'https://www.bancoagricola.com/productos/prestamos/',
      garantia: 'Prendaria sobre el vehiculo',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Constancia salarial o comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion o factura proforma', 'Seguro vehicular', 'Para usados: revision y antiguedad segun politica'] }
      ]
    },
    hipoteca: {
      tasaCRC: 8.25, tasaUSD: 8.25, plazoMax: 25, ratioMax: 0.35,
      comision: 2.5, financia: 0.90, ingresoMin: 900, montoMin: 20000,
      url: 'https://www.bancoagricola.com/productos/prestamos/',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente del solicitante y codeudor si aplica'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral de la propiedad'] }
      ]
    }
  },
  {
    id: 'sv_cuscatlan',
    pais: 'sv',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'Banco Cuscatlan',
    color: '#003B71',
    iniciales: 'CUS',
    tipo: 'Privado',
    web: 'https://www.cuscatlan.com/personas/prestamos',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 15.0, tasaUSD: 15.0, plazoMax: 5, ratioMax: 0.35,
      comision: 2.5, ingresoMin: 600, montoMin: 1000,
      url: 'https://www.cuscatlan.com/personas/prestamos',
      garantia: 'Segun producto y scoring',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Constancia salarial o comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Analisis crediticio', items: ['Revision de historial crediticio', 'Aprobacion sujeta a politica del banco'] }
      ]
    },
    vehiculo: {
      tasaCRC: 10.75, tasaUSD: 10.75, plazoMax: 6, ratioMax: 0.35,
      comision: 2.5, financia: 0.90, ingresoMin: 700, montoMin: 4000,
      url: 'https://www.cuscatlan.com/personas/prestamos',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion del vehiculo', 'Seguro vehicular', 'Aprobacion sujeta a revision si es usado'] }
      ]
    },
    hipoteca: {
      tasaCRC: 8.0, tasaUSD: 8.0, plazoMax: 25, ratioMax: 0.35,
      comision: 2.5, financia: 0.90, ingresoMin: 900, montoMin: 20000,
      url: 'https://www.cuscatlan.com/personas/prestamos',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral'] }
      ]
    }
  },
  {
    id: 'sv_davivienda',
    pais: 'sv',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'Davivienda El Salvador',
    color: '#ED1C27',
    iniciales: 'DAV',
    tipo: 'Privado',
    web: 'https://www.davivienda.com.sv/personas/prestamos',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 17.0, tasaUSD: 17.0, plazoMax: 5, ratioMax: 0.33,
      comision: 2.5, ingresoMin: 650, montoMin: 1000,
      url: 'https://www.davivienda.com.sv/personas/prestamos',
      garantia: 'Segun producto',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Analisis crediticio', items: ['Revision de historial crediticio', 'Aprobacion sujeta a politica crediticia'] }
      ]
    },
    vehiculo: {
      tasaCRC: 11.0, tasaUSD: 11.0, plazoMax: 6, ratioMax: 0.33,
      comision: 2.5, financia: 0.85, ingresoMin: 750, montoMin: 4000,
      url: 'https://www.davivienda.com.sv/personas/prestamos',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion del vehiculo', 'Seguro vehicular', 'Condiciones finales sujetas a evaluacion'] }
      ]
    },
    hipoteca: {
      tasaCRC: 8.25, tasaUSD: 8.25, plazoMax: 25, ratioMax: 0.33,
      comision: 2.5, financia: 0.90, ingresoMin: 950, montoMin: 20000,
      url: 'https://www.davivienda.com.sv/personas/prestamos',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral'] }
      ]
    }
  },
  {
    id: 'sv_bac',
    pais: 'sv',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'BAC Credomatic El Salvador',
    color: '#E30613',
    iniciales: 'BAC',
    tipo: 'Privado',
    web: 'https://www.baccredomatic.com/es-sv/personas/prestamos',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 18.0, tasaUSD: 18.0, plazoMax: 5, ratioMax: 0.33,
      comision: 2.5, ingresoMin: 650, montoMin: 1000,
      url: 'https://www.baccredomatic.com/es-sv/personas/prestamos',
      garantia: 'Segun producto y scoring',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante salarial o ingresos verificables', 'Estados de cuenta recientes'] },
        { categoria: 'Analisis crediticio', items: ['Revision de historial crediticio', 'Aprobacion sujeta a politica del banco'] }
      ]
    },
    vehiculo: {
      tasaCRC: 11.0, tasaUSD: 11.0, plazoMax: 6, ratioMax: 0.33,
      comision: 2.5, financia: 0.85, ingresoMin: 750, montoMin: 4000,
      url: 'https://www.baccredomatic.com/es-sv/personas/prestamos',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante salarial o ingresos verificables', 'Estados de cuenta recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion del vehiculo', 'Seguro vehicular', 'Aprobacion sujeta a avaluo o revision si es usado'] }
      ]
    },
    hipoteca: {
      tasaCRC: 8.0, tasaUSD: 8.0, plazoMax: 25, ratioMax: 0.33,
      comision: 2.5, financia: 0.90, ingresoMin: 950, montoMin: 20000,
      url: 'https://www.baccredomatic.com/es-sv/personas/prestamos',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante salarial o ingresos verificables', 'Estados de cuenta recientes'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral'] }
      ]
    }
  },
  {
    id: 'sv_promerica',
    pais: 'sv',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'Banco Promerica El Salvador',
    color: '#5BA850',
    iniciales: 'PRO',
    tipo: 'Privado',
    web: 'https://www.promerica.com.sv/prestamos',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 16.5, tasaUSD: 16.5, plazoMax: 5, ratioMax: 0.33,
      comision: 2.5, ingresoMin: 650, montoMin: 1000,
      url: 'https://www.promerica.com.sv/prestamos',
      garantia: 'Segun producto',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Analisis crediticio', items: ['Aprobacion sujeta a politica crediticia'] }
      ]
    },
    vehiculo: {
      tasaCRC: 10.75, tasaUSD: 10.75, plazoMax: 6, ratioMax: 0.33,
      comision: 2.5, financia: 0.85, ingresoMin: 750, montoMin: 4000,
      url: 'https://www.promerica.com.sv/prestamos',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion del vehiculo', 'Seguro vehicular', 'Condiciones finales sujetas a evaluacion'] }
      ]
    },
    hipoteca: {
      tasaCRC: 8.75, tasaUSD: 8.75, plazoMax: 25, ratioMax: 0.33,
      comision: 2.5, financia: 0.90, ingresoMin: 950, montoMin: 20000,
      url: 'https://www.promerica.com.sv/prestamos',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral'] }
      ]
    }
  },
  {
    id: 'sv_hipotecario',
    pais: 'sv',
    monedaBase: 'usd',
    calidadDato: 'referencial',
    nombre: 'Banco Hipotecario de El Salvador',
    color: '#174A7C',
    iniciales: 'BH',
    tipo: 'Publico',
    web: 'https://www.hipotecario.com.sv/creditos',
    verificado: '2026-06-01',
    personal: {
      tasaCRC: 14.0, tasaUSD: 14.0, plazoMax: 5, ratioMax: 0.35,
      comision: 2.5, ingresoMin: 600, montoMin: 1000,
      url: 'https://www.hipotecario.com.sv/creditos',
      garantia: 'Segun producto',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Analisis crediticio', items: ['Aprobacion sujeta a politica del banco'] }
      ]
    },
    vehiculo: {
      tasaCRC: 10.5, tasaUSD: 10.5, plazoMax: 6, ratioMax: 0.35,
      comision: 2.5, financia: 0.85, ingresoMin: 700, montoMin: 4000,
      url: 'https://www.hipotecario.com.sv/creditos',
      garantia: 'Prendaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Vehiculo', items: ['Cotizacion del vehiculo', 'Seguro vehicular', 'Condiciones finales sujetas a evaluacion'] }
      ]
    },
    hipoteca: {
      tasaCRC: 6.75, tasaUSD: 6.75, plazoMax: 30, ratioMax: 0.35,
      comision: 2.0, financia: 0.90, ingresoMin: 850, montoMin: 20000,
      url: 'https://www.hipotecario.com.sv/creditos',
      garantia: 'Hipotecaria',
      requisitos: [
        { categoria: 'Identificacion', items: ['Documento de identidad vigente'] },
        { categoria: 'Demostracion de ingresos', items: ['Comprobante de ingresos', 'Estados de cuenta recientes'] },
        { categoria: 'Propiedad', items: ['Promesa de compraventa', 'Avaluo', 'Documentacion registral'] }
      ]
    }
  }
];

function requisitosRegionales(tipoProducto) {
  const base = [
    { categoria: 'Identificacion', items: ['Documento de identidad vigente', 'Datos fiscales o tributarios cuando aplique'] },
    { categoria: 'Demostracion de ingresos', items: ['Constancia salarial o comprobante de ingresos', 'Estados de cuenta recientes', 'Historial laboral o actividad economica verificable'] }
  ];
  if (tipoProducto === 'vehiculo') {
    base.push({ categoria: 'Vehiculo', items: ['Cotizacion o factura proforma', 'Seguro vehicular cuando aplique', 'Para usados: revision y antiguedad segun politica del banco'] });
  }
  if (tipoProducto === 'hipoteca') {
    base.push({ categoria: 'Propiedad', items: ['Promesa de compraventa o detalle del inmueble', 'Avaluo de la propiedad', 'Documentacion registral o equivalente'] });
  }
  base.push({ categoria: 'Analisis crediticio', items: ['Aprobacion sujeta a politica del banco', 'Revision de historial crediticio y capacidad de pago'] });
  return base;
}

function productoRegional(datos, garantia, tipoProducto) {
  return {
    tasaCRC: datos.tasaLocal,
    tasaUSD: datos.tasaUSD ?? datos.tasaLocal,
    plazoMax: datos.plazoMax,
    ratioMax: datos.ratioMax ?? 0.35,
    comision: datos.comision ?? 2.5,
    financia: datos.financia,
    ingresoMin: datos.ingresoMin,
    montoMin: datos.montoMin,
    url: datos.url,
    garantia,
    requisitos: requisitosRegionales(tipoProducto)
  };
}

function bancoRegional(def) {
  return {
    id: def.id,
    pais: def.pais,
    monedaBase: 'local',
    calidadDato: 'referencial',
    nombre: def.nombre,
    color: def.color,
    iniciales: def.iniciales,
    tipo: def.tipo || 'Privado',
    web: def.web,
    verificado: '2026-06-01',
    personal: productoRegional(def.personal, 'Segun producto y scoring', 'personal'),
    vehiculo: productoRegional(def.vehiculo, 'Prendaria sobre el vehiculo', 'vehiculo'),
    hipoteca: productoRegional(def.hipoteca, 'Hipotecaria', 'hipoteca')
  };
}

const BANCOS_REGIONALES = [
  bancoRegional({
    id: 'mx_bbva', pais: 'mx', nombre: 'BBVA Mexico', color: '#004481', iniciales: 'BBVA', web: 'https://www.bbva.mx/personas/productos/creditos.html',
    personal: { tasaLocal: 23.9, plazoMax: 7, ingresoMin: 15000, montoMin: 20000, url: 'https://www.bbva.mx/personas/productos/creditos.html' },
    vehiculo: { tasaLocal: 11.0, plazoMax: 5, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.bbva.mx/personas/productos/creditos.html' },
    hipoteca: { tasaLocal: 9.8, plazoMax: 20, financia: 0.90, ingresoMin: 25000, montoMin: 300000, url: 'https://www.bbva.mx/personas/productos/creditos/credito-hipotecario/simulador.html' }
  }),
  bancoRegional({
    id: 'mx_santander', pais: 'mx', nombre: 'Santander Mexico', color: '#EC0000', iniciales: 'SAN', web: 'https://www.santander.com.mx/personas/prestamos.html',
    personal: { tasaLocal: 24.9, plazoMax: 5, ingresoMin: 15000, montoMin: 20000, url: 'https://www.santander.com.mx/personas/prestamos.html' },
    vehiculo: { tasaLocal: 13.0, plazoMax: 5, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.santander.com.mx/personas/prestamos.html' },
    hipoteca: { tasaLocal: 9.99, plazoMax: 20, financia: 0.90, ingresoMin: 25000, montoMin: 300000, url: 'https://www.santander.com.mx/personas/prestamos.html' }
  }),
  bancoRegional({
    id: 'mx_banamex', pais: 'mx', nombre: 'Banamex', color: '#E31B23', iniciales: 'BMX', web: 'https://www.banamex.com/es/personas/creditos.html',
    personal: { tasaLocal: 19.5, plazoMax: 5, ingresoMin: 15000, montoMin: 20000, url: 'https://www.banamex.com/es/personas/creditos.html' },
    vehiculo: { tasaLocal: 13.0, plazoMax: 5, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.banamex.com/es/personas/creditos.html' },
    hipoteca: { tasaLocal: 10.5, plazoMax: 20, financia: 0.90, ingresoMin: 25000, montoMin: 300000, url: 'https://www.banamex.com/es/personas/creditos.html' }
  }),
  bancoRegional({
    id: 'mx_banorte', pais: 'mx', nombre: 'Banorte', color: '#D71920', iniciales: 'BNT', web: 'https://www.banorte.com/es/personas/creditos.html',
    personal: { tasaLocal: 22.0, plazoMax: 7, ingresoMin: 15000, montoMin: 20000, url: 'https://www.banorte.com/es/personas/creditos.html' },
    vehiculo: { tasaLocal: 13.0, plazoMax: 5, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.banorte.com/es/personas/creditos.html' },
    hipoteca: { tasaLocal: 9.9, plazoMax: 20, financia: 0.90, ingresoMin: 25000, montoMin: 300000, url: 'https://www.banorte.com/es/personas/creditos.html' }
  }),
  bancoRegional({
    id: 'mx_hsbc', pais: 'mx', nombre: 'HSBC Mexico', color: '#DB0011', iniciales: 'HSBC', web: 'https://www.hsbc.com.mx/prestamos/',
    personal: { tasaLocal: 24.9, plazoMax: 5, ingresoMin: 15000, montoMin: 20000, url: 'https://www.hsbc.com.mx/prestamos/' },
    vehiculo: { tasaLocal: 13.5, plazoMax: 5, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.hsbc.com.mx/prestamos/' },
    hipoteca: { tasaLocal: 9.99, plazoMax: 20, financia: 0.90, ingresoMin: 25000, montoMin: 300000, url: 'https://www.hsbc.com.mx/prestamos/' }
  }),
  bancoRegional({
    id: 'mx_scotia', pais: 'mx', nombre: 'Scotiabank Mexico', color: '#D81E05', iniciales: 'SCO', web: 'https://www.scotiabank.com.mx/personas/creditos.html',
    personal: { tasaLocal: 22.0, plazoMax: 5, ingresoMin: 15000, montoMin: 20000, url: 'https://www.scotiabank.com.mx/personas/creditos.html' },
    vehiculo: { tasaLocal: 12.0, plazoMax: 5, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.scotiabank.com.mx/personas/creditos.html' },
    hipoteca: { tasaLocal: 10.6, plazoMax: 20, financia: 0.90, ingresoMin: 25000, montoMin: 300000, url: 'https://www.scotiabank.com.mx/personas/creditos.html' }
  }),
  bancoRegional({
    id: 'gt_bi', pais: 'gt', nombre: 'Banco Industrial', color: '#005BAB', iniciales: 'BI', web: 'https://www.bi.com.gt/prestamos',
    personal: { tasaLocal: 16.0, tasaUSD: 12.0, plazoMax: 5, ingresoMin: 4500, montoMin: 8000, url: 'https://www.bi.com.gt/prestamos' },
    vehiculo: { tasaLocal: 11.5, tasaUSD: 11.0, plazoMax: 6, financia: 0.85, ingresoMin: 5500, montoMin: 30000, url: 'https://www.bi.com.gt/prestamos' },
    hipoteca: { tasaLocal: 10.0, tasaUSD: 9.5, plazoMax: 25, financia: 0.80, ingresoMin: 8000, montoMin: 150000, url: 'https://www.bi.com.gt/prestamos' }
  }),
  bancoRegional({
    id: 'gt_banrural', pais: 'gt', nombre: 'Banrural', color: '#007A3D', iniciales: 'BR', web: 'https://www.banrural.com.gt/creditos',
    personal: { tasaLocal: 18.0, plazoMax: 5, ingresoMin: 4000, montoMin: 8000, url: 'https://www.banrural.com.gt/creditos' },
    vehiculo: { tasaLocal: 12.5, plazoMax: 6, financia: 0.85, ingresoMin: 5500, montoMin: 30000, url: 'https://www.banrural.com.gt/creditos' },
    hipoteca: { tasaLocal: 10.0, tasaUSD: 9.5, plazoMax: 25, financia: 0.80, ingresoMin: 7500, montoMin: 150000, url: 'https://www.banrural.com.gt/creditos' }
  }),
  bancoRegional({
    id: 'gt_bac', pais: 'gt', nombre: 'BAC Credomatic Guatemala', color: '#E30613', iniciales: 'BAC', web: 'https://www.baccredomatic.com/es-gt/personas/prestamos',
    personal: { tasaLocal: 21.0, plazoMax: 5, ingresoMin: 4500, montoMin: 8000, url: 'https://www.baccredomatic.com/es-gt/personas/prestamos' },
    vehiculo: { tasaLocal: 12.5, tasaUSD: 12.0, plazoMax: 6, financia: 0.85, ingresoMin: 5500, montoMin: 30000, url: 'https://www.baccredomatic.com/es-gt/personas/prestamos' },
    hipoteca: { tasaLocal: 10.5, tasaUSD: 9.5, plazoMax: 25, financia: 0.80, ingresoMin: 8000, montoMin: 150000, url: 'https://www.baccredomatic.com/es-gt/personas/prestamos' }
  }),
  bancoRegional({
    id: 'gt_gyt', pais: 'gt', nombre: 'G&T Continental', color: '#0B4EA2', iniciales: 'G&T', web: 'https://www.gytcontinental.com.gt/prestamos',
    personal: { tasaLocal: 18.5, plazoMax: 5, ingresoMin: 4500, montoMin: 8000, url: 'https://www.gytcontinental.com.gt/prestamos' },
    vehiculo: { tasaLocal: 12.5, plazoMax: 6, financia: 0.85, ingresoMin: 5500, montoMin: 30000, url: 'https://www.gytcontinental.com.gt/prestamos' },
    hipoteca: { tasaLocal: 10.0, tasaUSD: 10.0, plazoMax: 25, financia: 0.80, ingresoMin: 8000, montoMin: 150000, url: 'https://www.gytcontinental.com.gt/prestamos' }
  }),
  bancoRegional({
    id: 'gt_bam', pais: 'gt', nombre: 'Banco Agromercantil BAM', color: '#0072CE', iniciales: 'BAM', web: 'https://www.bam.com.gt/prestamos',
    personal: { tasaLocal: 17.0, plazoMax: 5, ingresoMin: 4500, montoMin: 8000, url: 'https://www.bam.com.gt/prestamos' },
    vehiculo: { tasaLocal: 12.0, plazoMax: 6, financia: 0.85, ingresoMin: 5500, montoMin: 30000, url: 'https://www.bam.com.gt/prestamos' },
    hipoteca: { tasaLocal: 9.5, tasaUSD: 9.5, plazoMax: 25, financia: 0.80, ingresoMin: 8000, montoMin: 150000, url: 'https://www.bam.com.gt/prestamos' }
  }),
  bancoRegional({
    id: 'hn_ficohsa', pais: 'hn', nombre: 'Banco Ficohsa Honduras', color: '#0050A4', iniciales: 'FIC', web: 'https://www.ficohsa.hn/banca-personas/prestamos',
    personal: { tasaLocal: 34.0, tasaUSD: 15.0, plazoMax: 5, ingresoMin: 15000, montoMin: 30000, url: 'https://www.ficohsa.hn/banca-personas/prestamos' },
    vehiculo: { tasaLocal: 18.0, tasaUSD: 12.0, plazoMax: 6, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.ficohsa.hn/banca-personas/prestamos' },
    hipoteca: { tasaLocal: 14.0, tasaUSD: 10.0, plazoMax: 25, financia: 0.85, ingresoMin: 25000, montoMin: 500000, url: 'https://www.ficohsa.hn/banca-personas/prestamos' }
  }),
  bancoRegional({
    id: 'hn_atlantida', pais: 'hn', nombre: 'Banco Atlantida', color: '#003B7A', iniciales: 'ATL', web: 'https://www.bancatlan.hn/personas/creditos',
    personal: { tasaLocal: 32.0, plazoMax: 5, ingresoMin: 15000, montoMin: 30000, url: 'https://www.bancatlan.hn/personas/creditos' },
    vehiculo: { tasaLocal: 18.0, plazoMax: 6, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.bancatlan.hn/personas/creditos' },
    hipoteca: { tasaLocal: 13.5, plazoMax: 20, financia: 0.85, ingresoMin: 25000, montoMin: 500000, url: 'https://www.bancatlan.hn/personas/creditos' }
  }),
  bancoRegional({
    id: 'hn_bac', pais: 'hn', nombre: 'BAC Credomatic Honduras', color: '#E30613', iniciales: 'BAC', web: 'https://www.baccredomatic.com/es-hn/personas/prestamos',
    personal: { tasaLocal: 30.0, tasaUSD: 13.5, plazoMax: 5, ingresoMin: 15000, montoMin: 30000, url: 'https://www.baccredomatic.com/es-hn/personas/prestamos' },
    vehiculo: { tasaLocal: 17.0, tasaUSD: 12.0, plazoMax: 6, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.baccredomatic.com/es-hn/personas/prestamos' },
    hipoteca: { tasaLocal: 13.0, tasaUSD: 12.0, plazoMax: 25, financia: 0.85, ingresoMin: 25000, montoMin: 500000, url: 'https://www.baccredomatic.com/es-hn/personas/prestamos' }
  }),
  bancoRegional({
    id: 'hn_occidente', pais: 'hn', nombre: 'Banco de Occidente', color: '#0B6E3D', iniciales: 'BO', web: 'https://www.bancodeoccidente.hn/prestamos',
    personal: { tasaLocal: 35.0, plazoMax: 5, ingresoMin: 15000, montoMin: 30000, url: 'https://www.bancodeoccidente.hn/prestamos' },
    vehiculo: { tasaLocal: 19.0, plazoMax: 6, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.bancodeoccidente.hn/prestamos' },
    hipoteca: { tasaLocal: 13.5, plazoMax: 20, financia: 0.85, ingresoMin: 25000, montoMin: 500000, url: 'https://www.bancodeoccidente.hn/prestamos' }
  }),
  bancoRegional({
    id: 'hn_banpais', pais: 'hn', nombre: 'Banpais', color: '#1C75BC', iniciales: 'BP', web: 'https://www.banpais.hn/productos/prestamos',
    personal: { tasaLocal: 37.0, plazoMax: 5, ingresoMin: 15000, montoMin: 30000, url: 'https://www.banpais.hn/productos/prestamos' },
    vehiculo: { tasaLocal: 19.0, plazoMax: 6, financia: 0.85, ingresoMin: 18000, montoMin: 100000, url: 'https://www.banpais.hn/productos/prestamos' },
    hipoteca: { tasaLocal: 14.0, plazoMax: 20, financia: 0.85, ingresoMin: 25000, montoMin: 500000, url: 'https://www.banpais.hn/productos/prestamos' }
  }),
  bancoRegional({
    id: 'ni_banpro', pais: 'ni', nombre: 'BANPRO', color: '#006341', iniciales: 'BAN', web: 'https://www.banpro.com.ni/personas/creditos',
    personal: { tasaLocal: 29.0, tasaUSD: 18.0, plazoMax: 5, ingresoMin: 20000, montoMin: 40000, url: 'https://www.banpro.com.ni/personas/creditos' },
    vehiculo: { tasaLocal: 17.0, tasaUSD: 16.0, plazoMax: 6, financia: 0.85, ingresoMin: 25000, montoMin: 150000, url: 'https://www.banpro.com.ni/personas/creditos' },
    hipoteca: { tasaLocal: 12.0, tasaUSD: 11.0, plazoMax: 20, financia: 0.85, ingresoMin: 35000, montoMin: 800000, url: 'https://www.banpro.com.ni/personas/creditos' }
  }),
  bancoRegional({
    id: 'ni_bac', pais: 'ni', nombre: 'BAC Credomatic Nicaragua', color: '#E30613', iniciales: 'BAC', web: 'https://www.baccredomatic.com/es-ni/personas/prestamos',
    personal: { tasaLocal: 24.0, tasaUSD: 15.0, plazoMax: 5, ingresoMin: 20000, montoMin: 40000, url: 'https://www.baccredomatic.com/es-ni/personas/prestamos' },
    vehiculo: { tasaLocal: 16.0, tasaUSD: 15.0, plazoMax: 6, financia: 0.85, ingresoMin: 25000, montoMin: 150000, url: 'https://www.baccredomatic.com/es-ni/personas/prestamos' },
    hipoteca: { tasaLocal: 11.0, tasaUSD: 10.0, plazoMax: 20, financia: 0.85, ingresoMin: 35000, montoMin: 800000, url: 'https://www.baccredomatic.com/es-ni/personas/prestamos' }
  }),
  bancoRegional({
    id: 'ni_lafise', pais: 'ni', nombre: 'LAFISE Bancentro', color: '#1B5E20', iniciales: 'LAF', web: 'https://www.lafise.com/blb/personas/prestamos',
    personal: { tasaLocal: 31.0, plazoMax: 5, ingresoMin: 20000, montoMin: 40000, url: 'https://www.lafise.com/blb/personas/prestamos' },
    vehiculo: { tasaLocal: 17.0, plazoMax: 6, financia: 0.85, ingresoMin: 25000, montoMin: 150000, url: 'https://www.lafise.com/blb/personas/prestamos' },
    hipoteca: { tasaLocal: 12.0, tasaUSD: 11.0, plazoMax: 20, financia: 0.85, ingresoMin: 35000, montoMin: 800000, url: 'https://www.lafise.com/blb/personas/prestamos' }
  }),
  bancoRegional({
    id: 'ni_avanz', pais: 'ni', nombre: 'Banco AVANZ', color: '#F58220', iniciales: 'AVZ', web: 'https://www.avanz.com.ni/',
    personal: { tasaLocal: 38.0, plazoMax: 5, ingresoMin: 16000, montoMin: 25000, url: 'https://www.avanz.com.ni/' },
    vehiculo: { tasaLocal: 22.0, plazoMax: 5, financia: 0.80, ingresoMin: 22000, montoMin: 120000, url: 'https://www.avanz.com.ni/' },
    hipoteca: { tasaLocal: 13.0, tasaUSD: 12.0, plazoMax: 15, financia: 0.80, ingresoMin: 35000, montoMin: 800000, url: 'https://www.avanz.com.ni/' }
  }),
  bancoRegional({
    id: 'ni_ficohsa', pais: 'ni', nombre: 'Banco Ficohsa Nicaragua', color: '#0050A4', iniciales: 'FIC', web: 'https://www.ficohsa.com.ni/personas/creditos',
    personal: { tasaLocal: 30.0, plazoMax: 5, ingresoMin: 20000, montoMin: 40000, url: 'https://www.ficohsa.com.ni/personas/creditos' },
    vehiculo: { tasaLocal: 17.0, plazoMax: 6, financia: 0.85, ingresoMin: 25000, montoMin: 150000, url: 'https://www.ficohsa.com.ni/personas/creditos' },
    hipoteca: { tasaLocal: 12.0, tasaUSD: 11.0, plazoMax: 20, financia: 0.85, ingresoMin: 35000, montoMin: 800000, url: 'https://www.ficohsa.com.ni/personas/creditos' }
  })
];

BANCOS.push(...BANCOS_REGIONALES);

const CONFIG_TIPOS = {
  personal: { plazoMin: 1, plazoDef: 5, prima: false, label: 'préstamo personal' },
  vehiculo: { plazoMin: 1, plazoDef: 6, prima: true, primaMax: 30000000, primaDef: 3000000, label: 'préstamo de vehículo' },
  hipoteca: { plazoMin: 5, plazoDef: 20, prima: true, primaMax: 80000000, primaDef: 15000000, label: 'crédito hipotecario' }
};

// Tipo de cambio aproximado (en producción debería conectarse a API del BCCR)
const TIPO_CAMBIO_USD = 510;

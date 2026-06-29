// Datos orientativos de aseguradoras para PreCali Seguros.
// MVP activo: Costa Rica. Data regional respaldada en backups/data-aseguradoras-regional-2026-06-29.js.
// No son tarifas vinculantes: se usan para estimar rangos y dirigir al cotizador oficial.
const ASEGURADORAS = [
  {
    "id": "ins_cr",
    "pais": "cr",
    "nombre": "INS",
    "iniciales": "INS",
    "color": "#005baa",
    "tipo": "Estatal",
    "rating": 8.8,
    "web": "https://asegurate.grupoins.com/frmEstimacionVehVol.aspx",
    "productos": {
      "auto": {
        "factor": 1,
        "cotizador": "https://asegurate.grupoins.com/frmEstimacionVehVol.aspx",
        "nota": "Incluye referencia para voluntario; el SOA es obligatorio y separado."
      },
      "vida": {
        "factor": 1.02,
        "cotizador": "https://www.grupoins.com/"
      },
      "salud": {
        "factor": 1.02,
        "cotizador": "https://www.grupoins.com/"
      }
    }
  },
  {
    "id": "sura_cr",
    "pais": "cr",
    "nombre": "SURA Costa Rica",
    "iniciales": "SUR",
    "color": "#0033a0",
    "tipo": "Privada",
    "rating": 8.5,
    "web": "https://www.segurossura.com.cr/cotizar/",
    "productos": {
      "auto": {
        "factor": 1.08,
        "cotizador": "https://www.segurossura.com.cr/cotizar/"
      },
      "vida": {
        "factor": 1.05,
        "cotizador": "https://www.segurossura.com.cr/"
      },
      "salud": {
        "factor": 1.08,
        "cotizador": "https://www.segurossura.com.cr/"
      }
    }
  },
  {
    "id": "mapfre_cr",
    "pais": "cr",
    "nombre": "MAPFRE Costa Rica",
    "iniciales": "MAP",
    "color": "#d71920",
    "tipo": "Privada",
    "rating": 8.2,
    "web": "https://www.mapfre.cr/cotizador/",
    "productos": {
      "auto": {
        "factor": 1.03,
        "cotizador": "https://www.mapfre.cr/cotizador/"
      },
      "vida": {
        "factor": 1,
        "cotizador": "https://www.mapfre.cr/"
      },
      "salud": {
        "factor": 1.02,
        "cotizador": "https://www.mapfre.cr/"
      }
    }
  },
  {
    "id": "qualitas_cr",
    "pais": "cr",
    "nombre": "Quálitas Costa Rica",
    "iniciales": "QLT",
    "color": "#0060a8",
    "tipo": "Privada",
    "rating": 8.1,
    "web": "https://www.qualitas.cr/",
    "productos": {
      "auto": {
        "factor": 0.92,
        "cotizador": "https://www.qualitas.cr/",
        "nota": "Especialista en autos."
      }
    }
  },
  {
    "id": "palig_cr",
    "pais": "cr",
    "nombre": "Pan American Life",
    "iniciales": "PAL",
    "color": "#00539f",
    "tipo": "Privada",
    "rating": 8.7,
    "web": "https://www.palig.com/es/countries/costa-rica",
    "productos": {
      "vida": {
        "factor": 0.98,
        "cotizador": "https://www.palig.com/es/countries/costa-rica"
      },
      "salud": {
        "factor": 0.99,
        "cotizador": "https://www.palig.com/es/countries/costa-rica"
      }
    }
  }
];

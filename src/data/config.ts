import type { ConfigTipos } from '../types/precali';

export const CONFIG_TIPOS: ConfigTipos = {
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

export const TIPO_CAMBIO_USD = 510 as const;

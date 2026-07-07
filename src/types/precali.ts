export type PaisId = 'cr' | 'mx' | 'gt' | 'sv' | 'hn' | 'ni' | 'pa';
export type TipoPrestamo = 'personal' | 'vehiculo' | 'hipoteca';
export type TipoBanco = 'Público' | 'Privado';

export interface Pais {
  id: PaisId; nombre: string; bandera: string; moneda: string;
  simbolo: string; cambioUSD: number; estado: 'activo' | 'borrador'; bancos: number;
}
export interface AvisoLegal { creditos: string; seguros: string; privacidad: string; }
export interface RequisitoCategoria { categoria: string; items: string[]; }
export interface CondicionPrestamo {
  tasaCRC: number; tasaUSD: number; plazoMax: number; ratioMax: number; comision: number;
  ingresoMin?: number; montoMin?: number; primaMin?: number; primaMax?: number;
  url?: string; garantia?: string; notas?: string; requisitos?: RequisitoCategoria[];
  financia?: number;
}
export interface Banco {
  id: string; nombre: string; color: string; iniciales: string; tipo: TipoBanco;
  web: string; verificado: string;
  personal: CondicionPrestamo; vehiculo: CondicionPrestamo; hipoteca: CondicionPrestamo;
}
export interface ConfigTipo {
  plazoMin: number; plazoDef: number; prima: boolean;
  primaMax?: number; primaDef?: number; label: string;
}
export type ConfigTipos = Record<TipoPrestamo, ConfigTipo>;

export type TipoAseguradora = 'Estatal' | 'Privada';
export interface ProductoSeguro { factor: number; cotizador: string; nota?: string; }
export interface Aseguradora {
  id: string; pais: PaisId; nombre: string; iniciales: string; color: string;
  tipo: TipoAseguradora; rating: number; web: string;
  productos: { auto?: ProductoSeguro; vida?: ProductoSeguro; salud?: ProductoSeguro };
}

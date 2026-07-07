// Tipos de dominio para el motor calificador con mock de buró (Equifax/SUGEF ICIC).
// Ver plans/2026-07-02-motor-calificador-buro-mock/plan.md para el contexto de negocio.

export type SugefCategoria = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "D" | "E";

/** 1=bueno 2=aceptable 3=deficiente */
export type ComportamientoPagoHistorico = 1 | 2 | 3;

export interface OperacionCredito {
  tipo: "hipotecario" | "prendario" | "personal" | "tarjeta";
  entidad: string;
  montoAdeudado: number;
  diasAtraso: number;
  cancelada: boolean;
}

export interface BuroMockResponse {
  idNumber: string;
  score: number;
  categoriaSugef: SugefCategoria;
  comportamientoPagoHistorico: ComportamientoPagoHistorico;
  operaciones: OperacionCredito[];
  montoTotalAdeudado: number;
  entidadesConsultantesUltimos30Dias: number;
  protestosComerciales: number;
  historialMeses: 48;
  fechaConsulta: string;
}

export type NivelCalificacion = 1 | 2 | 3;

export interface EngineConfig {
  scorePrimeThreshold: number;
  ratioDeudaIngresoAlerta: number;
  ratioDeudaIngresoPrecalificado: number;
  moraActivaDiasLimite: number;
  shoppingCreditoConsultas30d: number;
}

export interface EngineResult {
  nivel: NivelCalificacion;
  categoriaSugef: SugefCategoria;
  score: number;
  ratioDeudaIngreso: number;
  moraActivaSevera: boolean;
  shoppingCredito: boolean;
  ratioAlto: boolean;
  motivo: string;
}

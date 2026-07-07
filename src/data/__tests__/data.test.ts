import { describe, it, expect } from 'vitest';
import { PAISES } from '../paises';
import { AVISOS_LEGALES } from '../avisos';
import { BANCOS } from '../bancos';
import { CONFIG_TIPOS, TIPO_CAMBIO_USD } from '../config';
import { ASEGURADORAS } from '../aseguradoras';

describe('PreCali typed data modules', () => {
  it('exposes Costa Rica as the first/only active country', () => {
    expect(PAISES[0].id).toBe('cr');
    expect(PAISES[0].estado).toBe('activo');
  });

  it('contains exactly the expected number of bancos (8)', () => {
    expect(BANCOS).toHaveLength(8);
  });

  it('every banco has personal, vehiculo and hipoteca conditions', () => {
    for (const banco of BANCOS) {
      expect(banco.personal).toBeDefined();
      expect(banco.vehiculo).toBeDefined();
      expect(banco.hipoteca).toBeDefined();
    }
  });

  it('exposes the USD exchange rate as 510', () => {
    expect(TIPO_CAMBIO_USD).toBe(510);
  });

  it('exposes the three config tipos', () => {
    expect(CONFIG_TIPOS.personal.label).toBe('préstamo personal');
    expect(CONFIG_TIPOS.vehiculo.prima).toBe(true);
    expect(CONFIG_TIPOS.hipoteca.plazoDef).toBe(20);
  });

  it('exposes legal notices for Costa Rica', () => {
    expect(AVISOS_LEGALES.cr).toBeDefined();
    expect(AVISOS_LEGALES.cr?.creditos.length).toBeGreaterThan(0);
  });

  it('contains exactly the expected number of aseguradoras (5)', () => {
    expect(ASEGURADORAS).toHaveLength(5);
  });

  it('BANCOS snapshot catches future drift', () => {
    expect(BANCOS).toMatchSnapshot();
  });
});

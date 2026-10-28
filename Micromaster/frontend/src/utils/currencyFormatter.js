/**
 * Formatea valores numéricos a Pesos Colombianos (COP).
 * Ejemplo: 1250000 -> "$ 1.250.000"
 */
export function formatCOP(value, withCode = false) {
  if (value == null || isNaN(value)) return withCode ? '$ 0 COP' : '$ 0';
  const num = Math.round(Number(value));
  const formatted = num.toLocaleString('es-CO');
  return withCode ? `$ ${formatted} COP` : `$ ${formatted}`;
}

/**
 * Formatea el costo unitario por medida.
 * Ejemplo: 4200, "kg" -> "$ 4.200 / kg"
 */
export function formatUnitCOP(value, unit = 'kg') {
  if (value == null || isNaN(value)) return `$ 0 / ${unit}`;
  const num = Math.round(Number(value));
  return `$ ${num.toLocaleString('es-CO')} / ${unit}`;
}

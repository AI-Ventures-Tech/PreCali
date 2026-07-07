# Endpoint de Buró de Crédito (Mock)

Consulta el motor calificador de buró de crédito de PreCali. Hoy sirve un mock determinístico de Equifax/SUGEF; el contrato HTTP es estable y sobrevive el swap al cliente real sin que los callers lo notes.

## URL

```
POST https://www.kincena.com/api/buro
```

## Request

Header:

```
Content-Type: application/json
```

Body:

| Campo        | Tipo   | Requerido | Notas                              |
| ------------ | ------ | --------- | ---------------------------------- |
| `idNumber`   | string | sí        | Cédula (mín. 3 chars)              |
| `x-api-key`  | header | cond.     | Solo si `PRECALI_BURO_API_KEY` set |

## Respuesta

```json
{
  "ok": true,
  "data": {
    "idNumber": "1-0000-0028",
    "score": 409,
    "sugefCategory": "D",
    "historicalPaymentBehavior": 3,
    "operations": [
      {
        "type": "prendario" | "personal" | "tarjeta" | "hipotecario" | ...,
        "institution": "Banco de Costa Rica",
        "amountOwed": 0,
        "daysPastDue": 0,
        "closed": true
      }
    ],
    "totalAmountOwed": 9095000,
    "inquiriesLast30Days": 2,
    "commercialProtests": 2,
    "historyMonths": 48,
    "inquiryDate": "2026-07-07T20:38:24.309Z",
    "status": "completed",
    "hitCode": { "code": "1" },
    "links": []
  }
}
```

Errores:

| Status | error           | Causa                                  |
| ------ | --------------- | -------------------------------------- |
| 400    | `invalid_json`  | Body no es JSON válido                 |
| 400    | fieldErrors     | Validación Zod falló                   |
| 401    | `unauthorized`  | Falta o no coincide `x-api-key`        |
| 429    | `rate_limited`  | Límite por IP excedido                 |

---

## Cédulas de prueba

El mock es determinístico: la misma cédula siempre devuelve el mismo resultado byte por byte.

| Nombre    | Cédula         | Categoría SUGEF | Score | Perfil                                   |
| --------- | -------------- | --------------- | ----- | ---------------------------------------- |
| Pedro     | `7-0000-0049`  | E               | 313   | Sobreendeudado, historial dañado        |
| María     | `1-0000-0028`  | D               | 409   | Mora severa activa (>90 días)            |
| José      | `2-0000-0015`  | C2              | 488   | Bajo ingreso, categoría baja             |
| Ana       | `3-0000-0009`  | C1              | 628   | Categoría baja + credit shopping         |
| Carlos    | `5-0000-0003`  | B2              | 642   | Límite superior de alto riesgo           |
| Luis      | `4-0000-0014`  | B1              | 692   | Score bajo (recuperando historial)       |
| Sofía     | `6-0000-0004`  | A2              | 756   | A2 sobreendeudado (ratio > 0.50 → cap)   |
| Diego     | `1-0000-0003`  | B1              | 684   | B1 con score < 700                       |
| Elena     | `2-0000-0033`  | B1              | 680   | A2 con score insuficiente                |
| Marco     | `3-0000-0004`  | B1              | 687   | B1 con ratio en el límite                |
| Patricia  | `1-0000-0009`  | A1              | 812   | Cliente premium                          |
| Roberto   | `4-0000-0001`  | A2              | 800   | A2 sólido, alto ingreso                  |
| Carmen    | `2-0000-0006`  | A2              | 789   | A2 con historial limpio                  |
| Andrés    | `3-0000-0006`  | B1              | 713   | B1 con score alto                        |
| Gabriela  | `5-0000-0014`  | A1              | 810   | A1 — ingreso premium                     |

---

## Ejemplos

### curl

```bash
curl -X POST https://www.kincena.com/api/buro \
  -H "Content-Type: application/json" \
  -d '{"idNumber":"1-0000-0009"}'
```

### JavaScript (fetch)

```javascript
const res = await fetch("https://www.kincena.com/api/buro", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ idNumber: "1-0000-0009" }),
});
const { data } = await res.json();
console.log(data.score, data.sugefCategory);
```

### Python (requests)

```python
import requests

r = requests.post(
    "https://www.kincena.com/api/buro",
    json={"idNumber": "1-0000-0009"},
)
print(r.json()["data"]["score"])
```

### Probar todas las cédulas de una

```bash
for c in 7-0000-0049 1-0000-0028 2-0000-0015 3-0000-0009 5-0000-0003 \
         4-0000-0014 6-0000-0004 1-0000-0003 2-0000-0033 3-0000-0004 \
         1-0000-0009 4-0000-0001 2-0000-0006 3-0000-0006 5-0000-0014; do
  echo "=== $c ==="
  curl -s -X POST https://www.kincena.com/api/buro \
    -H "Content-Type: application/json" \
    -d "{\"idNumber\":\"$c\"}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(f\"cat={d['sugefCategory']}  score={d['score']}  owed={d['totalAmountOwed']}\")"
done
```

---

## Notas

- **Determinístico**: el mock hashea la cédula → misma entrada, misma salida siempre.
- **Cualquier string ≥ 3 chars funciona**: si pasás una cédula que no está en la lista de casos de prueba, el motor genera un perfil sintético determinístico a partir del hash. Útil para fuzzing/QA.
- **Sin auth en dev**: si `PRECALI_BURO_API_KEY` no está seteado en el ambiente, el endpoint es público. En producción, setealo y mandá `x-api-key`.
- **Rate limit**: compartido con `/api/lead`, por IP.
- **Logs**: nunca se loggea la cédula ni el payload bruto (solo categoría, score, timestamp).

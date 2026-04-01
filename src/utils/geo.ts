/**
 * Calcula a área de um polígono em hectares usando a fórmula de Shoelace,
 * projetando as coordenadas esféricas (lat/long) para o plano.
 *
 * @param boundaries Array de coordenadas [latitude, longitude].
 * @returns A área em hectares (ha), ou 0 se o polígono for inválido.
 */
export function polygonAreaHa(boundaries: [number, number][]): number {
  if (boundaries.length < 3) return 0;
  const R = 6371000; // Raio da Terra em metros
  let area = 0;
  for (let i = 0; i < boundaries.length; i++) {
    const [lat1, lon1] = boundaries[i];
    const [lat2, lon2] = boundaries[(i + 1) % boundaries.length];
    // Projeção equiretangular simplificada
    const x1 = (lon1 * Math.PI / 180) * R * Math.cos((lat1 * Math.PI / 180));
    const y1 = lat1 * Math.PI / 180 * R;
    const x2 = (lon2 * Math.PI / 180) * R * Math.cos((lat2 * Math.PI / 180));
    const y2 = lat2 * Math.PI / 180 * R;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2) / 10_000; // m² → ha
}

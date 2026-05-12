// src/components/ClippedImageOverlay.tsx
// Recorta uma imagem ao polígono do talhão usando SVG clipPath (Leaflet SVGOverlay)
// SVG nativo — funciona 100% das vezes, sem timing/load events.

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export interface ClippedImageOverlayProps {
  url: string;
  bounds: L.LatLngBoundsExpression;
  fieldBoundaries: [number, number][];
  opacity?: number;
}

export default function ClippedImageOverlay({
  url,
  bounds,
  fieldBoundaries,
  opacity = 0.95,
}: ClippedImageOverlayProps) {
  const map = useMap();

  useEffect(() => {
    if (!url || !fieldBoundaries || fieldBoundaries.length < 3) return;

    const lb =
      bounds instanceof L.LatLngBounds
        ? bounds
        : L.latLngBounds(bounds as L.LatLngBoundsLiteral);
    const sw = lb.getSouthWest();
    const ne = lb.getNorthEast();
    const latSpan = ne.lat - sw.lat;
    const lngSpan = ne.lng - sw.lng;
    if (!latSpan || !lngSpan) return;

    // viewBox grande para boa precisão
    const VB = 1000;
    const pts = fieldBoundaries
      .map(([lat, lng]) => {
        const x = (((lng - sw.lng) / lngSpan) * VB).toFixed(2);
        const y = ((1 - (lat - sw.lat) / latSpan) * VB).toFixed(2);
        return `${x},${y}`;
      })
      .join(' ');

    const clipId = `tf-clip-${Math.random().toString(36).slice(2, 10)}`;
    const svgNS = 'http://www.w3.org/2000/svg';
    const xlinkNS = 'http://www.w3.org/1999/xlink';

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('xmlns:xlink', xlinkNS);
    svg.setAttribute('viewBox', `0 0 ${VB} ${VB}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const defs = document.createElementNS(svgNS, 'defs');
    const clipPath = document.createElementNS(svgNS, 'clipPath');
    clipPath.setAttribute('id', clipId);
    clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const polygon = document.createElementNS(svgNS, 'polygon');
    polygon.setAttribute('points', pts);
    clipPath.appendChild(polygon);
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    const img = document.createElementNS(svgNS, 'image');
    // href e xlink:href para máxima compatibilidade
    img.setAttribute('href', url);
    img.setAttributeNS(xlinkNS, 'xlink:href', url);
    img.setAttribute('x', '0');
    img.setAttribute('y', '0');
    img.setAttribute('width', String(VB));
    img.setAttribute('height', String(VB));
    img.setAttribute('preserveAspectRatio', 'none');
    img.setAttribute('clip-path', `url(#${clipId})`);
    svg.appendChild(img);

    const overlay = L.svgOverlay(svg, lb, {
      opacity,
      interactive: false,
    });
    overlay.addTo(map);

    return () => {
      map.removeLayer(overlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, map]);

  return null;
}

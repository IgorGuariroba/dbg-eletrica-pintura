/** Captura coordenadas sem travar o fluxo: falha silenciosa em até 5s. */
export function obterLocalizacao(): Promise<
  { lat: number; lon: number } | undefined
> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(undefined),
      { timeout: 5000 },
    );
  });
}

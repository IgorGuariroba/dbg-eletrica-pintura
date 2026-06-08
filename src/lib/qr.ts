import QRCode from "qrcode";

/**
 * Gera um QR Code de uma URL como data URL PNG (`data:image/png;base64,...`),
 * pronto para `<Image>`/`<img src>`. Usado no PWA presencial para o cliente
 * escanear a landing de assinatura no próprio dispositivo.
 */
export async function gerarQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 256 });
}

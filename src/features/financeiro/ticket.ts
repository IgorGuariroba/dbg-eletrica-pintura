export function calcularTicketMedio(soma: string | null | undefined, qtd: number): string {
  if (!soma || qtd <= 0) return "0.00";
  const num = parseFloat(soma);
  if (isNaN(num)) return "0.00";
  return (num / qtd).toFixed(2);
}

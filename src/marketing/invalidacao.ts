export class MotivoObrigatorioError extends Error {
  readonly status = 400;
  constructor(message = "Motivo de invalidação é obrigatório") {
    super(message);
    this.name = "MotivoObrigatorioError";
  }
}

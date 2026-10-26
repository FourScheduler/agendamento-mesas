export interface Reserva {
  readonly id: number;
  readonly status: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA';
  readonly data: string;
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly criadaEm: string;
  readonly confirmadaEm?: string;
  readonly mesa: {
    readonly id: number;
    readonly codigo: string;
    readonly regiao: string;
  };
}
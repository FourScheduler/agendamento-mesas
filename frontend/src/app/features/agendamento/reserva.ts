export interface Reserva {
  readonly id: number;
  readonly status: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA';
  readonly data: string;
  readonly criadaEm: string;
  readonly confirmadaEm?: string;
  readonly mesa: {
    readonly id: number;
    readonly codigo: string;
    readonly regiao: string;
  };
  readonly solicitante?: { readonly id: number; readonly nome: string; readonly email: string };
}

export interface ReservaConfirmada extends Reserva {
  readonly status: 'CONFIRMADA';
  readonly confirmadaEm: string;
  readonly solicitante: { readonly id: number; readonly nome: string; readonly email: string };
}

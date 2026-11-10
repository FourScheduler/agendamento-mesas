export interface Reserva {
  readonly id: number;
  readonly usuarioId: number;
  readonly status: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA';
  readonly data: string;
  readonly criadaEm: string;
  readonly canceladaEm?: string | null;
  readonly chaveRequisicao?: string | null;
  readonly confirmadaEm?: string;
  readonly criador?: {
    readonly id: number;
    readonly nome: string;
    readonly perfil: 'USUARIO' | 'ADMIN';
  } | null;
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

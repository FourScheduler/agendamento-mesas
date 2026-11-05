export interface UsuarioResumo {
  readonly id: number;
  readonly nome: string;
  readonly email: string;
}

export interface Mesa {
  readonly id: number;
  readonly codigo: string;
  readonly regiao: string;
  readonly tipo: 'LIVRE' | 'FIXA';
  readonly ativa: boolean;
  readonly responsavel?: UsuarioResumo | null;
  readonly ocupanteNaData?: UsuarioResumo | null;
  readonly ocupante: string | null;
  readonly ocupada: boolean;
  readonly referenciaVisual: {
    readonly planta: string;
    readonly x: number;
    readonly y: number;
  };
}

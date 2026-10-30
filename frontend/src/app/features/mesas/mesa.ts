export interface Mesa {
  readonly id: number;
  readonly codigo: string;
  readonly regiao: string;
  readonly tipo: 'LIVRE' | 'FIXA';
  readonly ativa: boolean;
  readonly ocupante: string | null;
  readonly referenciaVisual: {
    readonly planta: string;
    readonly x: number;
    readonly y: number;
  };
}

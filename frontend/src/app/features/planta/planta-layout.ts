// Geometria decorativa da planta de demonstração; mesas e códigos vêm da API.
export const TAMANHO_MESA = { largura: 180, altura: 92 } as const;
export const TAMANHO_MESA_LEGADO = { largura: 64, altura: 44 } as const;

export const PLANTA_TAMBORE = {
  largura: 1670,
  altura: 1972,
  entrada: { x: 836, y: 656, largura: 745, altura: 340 },
  parede: { x: 1594, y: 48, largura: 52, altura: 1800 },
  estruturas: [
    { x: 840, y: 440, largura: 358, altura: 197 },
    { x: 1022, y: 1048, largura: 180, altura: 92 },
  ],
} as const;

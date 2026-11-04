import { Mesa } from '../mesas/mesa';

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

const ampliarY = (y: number) => 24 + (y - 24) * 1.4;
const ajustarX = (x: number) => x < 800
  ? 24 + (x - 24) * 180 / 189
  : 956 + (x - 836) * 180 / 189;
const ajustarEstrutura = (estrutura: { x: number; y: number; largura: number; altura: number }) => ({
  x: ajustarX(estrutura.x), y: ampliarY(estrutura.y),
  largura: estrutura.largura * 180 / 189, altura: estrutura.altura * 1.4,
});

export const PLANTA_TAMBORE_EXIBICAO = {
  largura: Math.ceil(ajustarX(PLANTA_TAMBORE.largura)),
  altura: Math.ceil(ampliarY(PLANTA_TAMBORE.altura)),
  entrada: ajustarEstrutura(PLANTA_TAMBORE.entrada),
  parede: ajustarEstrutura(PLANTA_TAMBORE.parede),
  estruturas: [
    {
      x: 956 + 2 * TAMANHO_MESA.largura - TAMANHO_MESA.largura,
      y: ampliarY(445) + TAMANHO_MESA.altura,
      largura: TAMANHO_MESA.largura,
      altura: TAMANHO_MESA.altura,
    },
    {
      x: 956 + Math.round((PLANTA_TAMBORE.estruturas[1].x - 836) / 189) * TAMANHO_MESA.largura,
      y: ampliarY(PLANTA_TAMBORE.estruturas[1].y),
      largura: TAMANHO_MESA.largura,
      altura: TAMANHO_MESA.altura,
    },
  ],
};

export function agruparFileiras(
  mesas: readonly Mesa[],
  tamanho: { largura: number; altura: number },
  separarCorredor: boolean,
) {
  const posicoes = new Map(mesas.map(mesa => [
    mesa.id, { x: mesa.referenciaVisual.x, y: mesa.referenciaVisual.y, superior: true, inferior: true },
  ]));
  const blocos = separarCorredor
    ? [mesas.filter(m => m.referenciaVisual.x < 800), mesas.filter(m => m.referenciaVisual.x >= 800)]
    : [mesas];

  for (const bloco of blocos) {
    if (separarCorredor) {
      for (const mesa of bloco) {
        const origem = mesa.referenciaVisual.x < 800 ? 24 : 836;
        const coluna = Math.round((mesa.referenciaVisual.x - origem) / 189);
        posicoes.set(mesa.id, {
          x: (origem === 24 ? 24 : 956) + coluna * tamanho.largura,
          y: ampliarY(mesa.referenciaVisual.y), superior: true, inferior: true,
        });
      }
    }
    const fileiras: Mesa[][] = [];
    for (const mesa of [...bloco].sort((a, b) => a.referenciaVisual.y - b.referenciaVisual.y)) {
      const ultima = fileiras.at(-1);
      if (ultima && mesa.referenciaVisual.y - ultima[0].referenciaVisual.y <= 8) ultima.push(mesa);
      else fileiras.push([mesa]);
    }
    for (let i = 0; i < fileiras.length - 1;) {
      const superior = fileiras[i];
      const inferior = fileiras[i + 1];
      const distancia = inferior[0].referenciaVisual.y - superior[0].referenciaVisual.y;
      if (distancia > tamanho.altura * 1.6) {
        i++;
        continue;
      }
      const ySuperior = posicoes.get(superior[0].id)!.y;
      for (const mesa of superior) {
        posicoes.set(mesa.id, { ...posicoes.get(mesa.id)!, y: ySuperior });
      }
      for (const mesa of inferior) {
        posicoes.set(mesa.id, {
          ...posicoes.get(mesa.id)!, y: ySuperior + tamanho.altura,
        });
      }
      for (const mesa of superior) {
        const vizinha = inferior.find(m =>
          Math.abs(m.referenciaVisual.x - mesa.referenciaVisual.x) <= tamanho.largura / 2);
        if (!vizinha) continue;
        const posicao = posicoes.get(mesa.id)!;
        posicoes.set(mesa.id, { ...posicao, superior: true, inferior: false });
        posicoes.set(vizinha.id, {
          ...posicoes.get(vizinha.id)!, y: posicao.y + tamanho.altura,
          superior: false, inferior: true,
        });
      }
      i += 2;
    }
  }
  if (separarCorredor) {
    for (const mesa of mesas) {
      const codigo = Number(mesa.codigo);
      const ajusteY = codigo >= 65 && codigo <= 72
        ? -32
        : codigo >= 73 && codigo <= 80
          ? 32
          : 0;
      if (ajusteY !== 0) {
        const posicao = posicoes.get(mesa.id)!;
        posicoes.set(mesa.id, { ...posicao, y: posicao.y + ajusteY });
      }
    }
  }
  if (separarCorredor) {
    for (const posicao of posicoes.values()) {
      const centroX = posicao.x + tamanho.largura / 2;
      for (const estrutura of PLANTA_TAMBORE_EXIBICAO.estruturas) {
        const sobrepoeX = centroX + 22 > estrutura.x
          && centroX - 22 < estrutura.x + estrutura.largura;
        if (!sobrepoeX) continue;
        if (posicao.y - 35 < estrutura.y + estrutura.altura && posicao.y > estrutura.y) {
          posicao.superior = false;
        }
        if (posicao.y + tamanho.altura + 35 > estrutura.y
          && posicao.y + tamanho.altura < estrutura.y + estrutura.altura) {
          posicao.inferior = false;
        }
      }
    }
  }
  return posicoes;
}

export function contornosBancadas(
  posicoes: ReadonlyMap<number, { x: number; y: number }>,
  tamanho: { largura: number; altura: number },
) {
  const restantes = [...posicoes.values()];
  const contornos: { x: number; y: number; largura: number; altura: number }[] = [];
  while (restantes.length) {
    const grupo = [restantes.pop()!];
    for (let i = 0; i < grupo.length; i++) {
      for (let j = restantes.length - 1; j >= 0; j--) {
        const a = grupo[i];
        const b = restantes[j];
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if ((dx < 0.1 && Math.abs(dy - tamanho.altura) < 0.1)
          || (dy < 0.1 && Math.abs(dx - tamanho.largura) < 0.1)) {
          grupo.push(...restantes.splice(j, 1));
        }
      }
    }
    const x = Math.min(...grupo.map(p => p.x));
    const y = Math.min(...grupo.map(p => p.y));
    contornos.push({
      x, y,
      largura: Math.max(...grupo.map(p => p.x)) + tamanho.largura - x,
      altura: Math.max(...grupo.map(p => p.y)) + tamanho.altura - y,
    });
  }
  return contornos;
}

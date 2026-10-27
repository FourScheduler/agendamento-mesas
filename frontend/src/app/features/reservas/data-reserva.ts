export function hojeSaoPaulo(): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find(p => p.type === tipo)!.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

export function adicionarDias(data: string, dias: number): string {
  const dia = new Date(`${data}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + dias);
  return dia.toISOString().slice(0, 10);
}

export function proximoDiaUtil(data: string): string {
  const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
  return adicionarDias(data, diaSemana === 6 ? 2 : diaSemana === 0 ? 1 : 0);
}

export function formatarData(data: string): string {
  return data.split('-').reverse().join('/');
}

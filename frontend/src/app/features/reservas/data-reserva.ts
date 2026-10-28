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

/** Mesmas regras de data do backend, no calendário de São Paulo. */
export function validarDataReserva(data: string, hoje = hojeSaoPaulo()): string {
  if (!data) return 'Informe a data da reserva.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return 'Informe uma data válida.';
  const dia = new Date(`${data}T12:00:00Z`);
  if (Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== data) return 'Informe uma data válida.';
  if (data < hoje) return 'Data deve ser hoje ou futura.';
  if (data > adicionarDias(hoje, 15)) return 'Data deve estar em até 15 dias a partir de hoje.';
  if (dia.getUTCDay() === 0 || dia.getUTCDay() === 6) return 'Reservas são permitidas apenas de segunda a sexta.';
  return '';
}

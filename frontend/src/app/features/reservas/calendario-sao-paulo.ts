import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { hojeSaoPaulo } from './data-reserva';

/** Referência de dia compartilhada; o fuso do navegador não define o calendário de negócio. */
@Injectable({ providedIn: 'root' })
export class CalendarioSaoPaulo {
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dia = signal(hojeSaoPaulo());
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  readonly hoje = this.dia.asReadonly();

  constructor() {
    const aoRetornar = () => this.atualizar();
    const aoMudarVisibilidade = () => {
      if (this.documento.visibilityState === 'visible') this.atualizar();
    };
    this.documento.defaultView?.addEventListener('focus', aoRetornar);
    this.documento.addEventListener('visibilitychange', aoMudarVisibilidade);
    this.atualizar();
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.temporizador);
      this.documento.defaultView?.removeEventListener('focus', aoRetornar);
      this.documento.removeEventListener('visibilitychange', aoMudarVisibilidade);
    });
  }

  /** Revalida também antes de operações, caso a aba tenha ficado suspensa. */
  atualizar(): string {
    const agora = new Date();
    const hoje = hojeSaoPaulo(agora);
    this.dia.set(hoje);
    clearTimeout(this.temporizador);
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo', hourCycle: 'h23',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(agora);
    const parte = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find(p => p.type === tipo)!.value);
    const decorrido = ((parte('hour') * 60 + parte('minute')) * 60 + parte('second')) * 1000
      + agora.getUTCMilliseconds();
    this.temporizador = setTimeout(() => this.atualizar(), 86_400_000 - decorrido);
    return hoje;
  }
}

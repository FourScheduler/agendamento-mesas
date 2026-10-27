import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';

const DURACAO_MS = 10000;

@Component({
  selector: 'app-notificacao',
  standalone: true,
  templateUrl: './notificacao.html',
  styleUrl: './notificacao.css',
})
export class Notificacao {
  readonly mensagem = input('');
  readonly tipo = input<'sucesso' | 'erro'>('sucesso');
  readonly fechar = output<void>();
  readonly restanteMs = signal(DURACAO_MS);
  readonly progresso = computed(() => this.restanteMs() / DURACAO_MS * 100);
  readonly pausado = signal(false);
  private readonly motivosPausa = new Set<'mouse' | 'foco'>();
  private prazo: number | null = null;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private atualizacao: ReturnType<typeof setInterval> | undefined;

  constructor() {
    effect(onCleanup => {
      const mensagem = this.mensagem();
      this.tipo();
      // Os ticks da contagem não devem reiniciar o efeito da mensagem.
      untracked(() => {
        this.pararContagem();
        this.restanteMs.set(DURACAO_MS);
        if (!mensagem) this.motivosPausa.clear();
        this.pausado.set(this.motivosPausa.size > 0);
        if (mensagem && !this.pausado()) this.iniciarContagem();
      });
      onCleanup(() => this.pararContagem());
    });
  }

  definirPausa(origem: 'mouse' | 'foco', pausar: boolean, evento?: FocusEvent) {
    if (origem === 'foco' && !pausar && evento?.currentTarget instanceof Node
      && evento.relatedTarget instanceof Node && evento.currentTarget.contains(evento.relatedTarget)) return;
    if (pausar) this.motivosPausa.add(origem);
    else this.motivosPausa.delete(origem);
    this.pausado.set(this.motivosPausa.size > 0);
    if (this.pausado()) {
      this.atualizarRestante();
      this.pararContagem();
    } else {
      this.iniciarContagem();
    }
  }

  fecharAgora() {
    this.pararContagem();
    this.fechar.emit();
  }

  private iniciarContagem() {
    if (this.temporizador !== undefined || !this.mensagem() || this.restanteMs() <= 0) return;
    const restante = this.restanteMs();
    this.prazo = performance.now() + restante;
    this.atualizacao = setInterval(() => this.atualizarRestante(), 100);
    this.temporizador = setTimeout(() => {
      this.pararContagem();
      this.restanteMs.set(0);
      this.fechar.emit();
    }, restante);
  }

  private atualizarRestante() {
    if (this.prazo !== null) this.restanteMs.set(Math.max(0, this.prazo - performance.now()));
  }

  private pararContagem() {
    clearTimeout(this.temporizador);
    clearInterval(this.atualizacao);
    this.temporizador = undefined;
    this.atualizacao = undefined;
    this.prazo = null;
  }
}

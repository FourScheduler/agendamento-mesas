import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { ToastTipo } from './toast';

@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-item.html',
  styleUrl: './toast-item.css',
})
export class ToastItem {
  readonly titulo = input('');
  readonly mensagem = input('');
  readonly tipo = input<ToastTipo>('sucesso');
  readonly duracao = 6000;
  readonly fechar = output<void>();
  readonly restanteMs = signal(0);
  readonly progresso = computed(() => this.restanteMs() / this.duracao * 100);
  private readonly motivosPausa = new Set<'mouse' | 'foco'>();
  private prazo: number | null = null;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private atualizacao: ReturnType<typeof setInterval> | undefined;
  private fechado = false;

  constructor() {
    effect(onCleanup => {
      const ativo = Boolean(this.titulo() || this.mensagem());
      const duracao = this.duracao;
      this.tipo();
      untracked(() => {
        this.pararContagem();
        this.fechado = false;
        this.restanteMs.set(duracao);
        if (!ativo) this.motivosPausa.clear();
        if (ativo && this.motivosPausa.size === 0) this.iniciarContagem();
      });
      onCleanup(() => this.pararContagem());
    });
  }

  definirPausa(origem: 'mouse' | 'foco', pausar: boolean, evento?: FocusEvent) {
    if (origem === 'foco' && !pausar && evento?.currentTarget instanceof Node
      && evento.relatedTarget instanceof Node && evento.currentTarget.contains(evento.relatedTarget)) return;
    if (pausar) this.motivosPausa.add(origem);
    else this.motivosPausa.delete(origem);
    if (this.motivosPausa.size > 0) {
      if (this.prazo !== null) this.restanteMs.set(Math.max(0, this.prazo - performance.now()));
      this.pararContagem();
    } else {
      this.iniciarContagem();
    }
  }

  fecharAgora() {
    if (this.fechado) return;
    this.fechado = true;
    this.pararContagem();
    this.fechar.emit();
  }

  private iniciarContagem() {
    if (this.fechado || this.temporizador !== undefined || this.restanteMs() <= 0) return;
    this.prazo = performance.now() + this.restanteMs();
    this.atualizacao = setInterval(() => {
      if (this.prazo !== null) this.restanteMs.set(Math.max(0, this.prazo - performance.now()));
    }, 100);
    this.temporizador = setTimeout(() => {
      this.restanteMs.set(0);
      this.fecharAgora();
    }, this.restanteMs());
  }

  private pararContagem() {
    clearTimeout(this.temporizador);
    clearInterval(this.atualizacao);
    this.temporizador = undefined;
    this.atualizacao = undefined;
    this.prazo = null;
  }
}

import { Directive, ElementRef, inject, signal } from '@angular/core';

@Directive({
  selector: '[appPainelArrastavel]',
  standalone: true,
  host: {
    '[class.painel--arrastando]': 'arrastando()',
    '(pointerdown)': 'iniciar($event)',
    '(pointermove)': 'moverPonteiro($event)',
    '(pointerup)': 'terminar($event)',
    '(pointercancel)': 'terminar($event)',
    '(lostpointercapture)': 'terminar($event)',
    '(keydown)': 'moverComTeclado($event)',
    '(window:resize)': 'ajustarAoRedimensionar()',
  },
})
export class PainelArrastavel {
  private readonly painel = inject(ElementRef<HTMLElement>).nativeElement;
  private arraste: { id: number; x: number; y: number; esquerda: number; topo: number } | null = null;
  private posicionado = false;
  readonly arrastando = signal(false);

  iniciar(evento: PointerEvent) {
    if (evento.button !== 0 || !evento.isPrimary || this.arraste || !this.peloCabecalho(evento.target) || !this.fixo()) return;
    const retangulo = this.painel.getBoundingClientRect();
    this.arraste = { id: evento.pointerId, x: evento.clientX, y: evento.clientY,
      esquerda: retangulo.left, topo: retangulo.top };
    this.painel.setPointerCapture(evento.pointerId);
    this.arrastando.set(true);
    evento.preventDefault();
  }

  moverPonteiro(evento: PointerEvent) {
    const inicio = this.arraste;
    if (!inicio || inicio.id !== evento.pointerId) return;
    this.posicionar(inicio.esquerda + evento.clientX - inicio.x, inicio.topo + evento.clientY - inicio.y);
  }

  terminar(evento?: PointerEvent) {
    if (!this.arraste || (evento && evento.pointerId !== this.arraste.id)) return;
    const id = this.arraste.id;
    this.arraste = null;
    this.arrastando.set(false);
    if (this.painel.hasPointerCapture(id)) this.painel.releasePointerCapture(id);
  }

  moverComTeclado(evento: KeyboardEvent) {
    if (!this.peloCabecalho(evento.target) || !this.fixo()) return;
    const direcoes: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const direcao = direcoes[evento.key];
    if (!direcao) return;
    const retangulo = this.painel.getBoundingClientRect();
    const passo = evento.shiftKey ? 40 : 10;
    this.posicionar(retangulo.left + direcao[0] * passo, retangulo.top + direcao[1] * passo);
    evento.preventDefault();
  }

  ajustarAoRedimensionar() {
    this.terminar();
    if (!this.posicionado) return;
    if (!this.fixo()) {
      // Em telas pequenas o cartão volta ao fluxo normal da página.
      for (const propriedade of ['left', 'top', 'right', 'bottom']) this.painel.style.removeProperty(propriedade);
      this.posicionado = false;
      return;
    }
    const retangulo = this.painel.getBoundingClientRect();
    this.posicionar(retangulo.left, retangulo.top);
  }

  private peloCabecalho(alvo: EventTarget | null): boolean {
    return alvo instanceof Element && !!alvo.closest('[data-arrastar-painel]')
      && !alvo.closest('button, a, input, select, textarea');
  }

  private fixo(): boolean {
    return getComputedStyle(this.painel).position === 'fixed';
  }

  private posicionar(esquerda: number, topo: number) {
    const margem = 8;
    const retangulo = this.painel.getBoundingClientRect();
    const largura = document.documentElement.clientWidth || window.innerWidth;
    const altura = window.innerHeight;
    const maximoX = Math.max(margem, largura - retangulo.width - margem);
    const maximoY = Math.max(margem, altura - retangulo.height - margem);
    this.painel.style.left = `${Math.max(margem, Math.min(esquerda, maximoX))}px`;
    this.painel.style.top = `${Math.max(margem, Math.min(topo, maximoY))}px`;
    this.painel.style.right = 'auto';
    this.painel.style.bottom = 'auto';
    this.posicionado = true;
  }
}

package br.com.foursys.agendamento_mesas.model;

import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.*;

/**
 * Mesa é uma estação individual de trabalho. {@code planta}, {@code posicaoX} e {@code posicaoY}
 * são apenas referência visual para o desenho da planta no frontend; não participam de regra de negócio.
 */
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Setter
@Getter
@Entity
@Table(name = "mesas", uniqueConstraints = @UniqueConstraint(name = "uk_mesas_codigo", columnNames = "codigo"))
public class Mesa {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo", nullable = false, length = 10)
    private String codigo;

    @Column(name = "regiao", nullable = false, length = 40)
    private String regiao;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 10)
    private TipoMesa tipo;

    @Column(name = "ativa", nullable = false)
    private boolean ativa;

    @Column(name = "planta", nullable = false, length = 20)
    private String planta;

    @Column(name = "posicao_x", nullable = false)
    private Integer posicaoX;

    @Column(name = "posicao_y", nullable = false)
    private Integer posicaoY;

    @Column(name = "ocupante", length = 120)
    private String ocupante;
}

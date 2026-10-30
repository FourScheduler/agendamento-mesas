package br.com.foursys.agendamento_mesas.model;

import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Getter
@Setter
@Table(name = "reservas")
public class Reserva {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mesa_id", nullable = false)
    private Mesa mesa;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "data", nullable = false)
    private LocalDate data;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private StatusReserva status;

    @Column(name = "criada_em", nullable = false, updatable = false)
    private LocalDateTime criadaEm;

    @Column(name = "confirmada_em")
    private LocalDateTime confirmadaEm;

    @Column(name = "cancelada_em")
    private LocalDateTime canceladaEm;

    protected Reserva() {
    }

    public Reserva(Mesa mesa, Usuario usuario, LocalDate data, StatusReserva status) {
        this.mesa = mesa;
        this.usuario = usuario;
        this.data = data;
        this.status = status;
    }

    @PrePersist
    void aoPersistir() {
        if (criadaEm == null) {
            criadaEm = confirmadaEm != null ? confirmadaEm : LocalDateTime.now(ZoneId.of("America/Sao_Paulo"));
        }
    }
}

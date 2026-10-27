package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.request.CriarReservaRequest;
import br.com.foursys.agendamento_mesas.dto.response.ReservaResponse;
import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Reserva;
import br.com.foursys.agendamento_mesas.repository.MesaRepository;
import br.com.foursys.agendamento_mesas.repository.ReservaRepository;
import br.com.foursys.agendamento_mesas.repository.UsuarioRepository;
import br.com.foursys.agendamento_mesas.security.UsuarioAutenticado;
import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReservaService {
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private final UsuarioRepository usuarios;
    private final MesaRepository mesas;
    private final ReservaRepository reservas;
    private final DataReservaValidator datas;
    private final Clock relogio;

    public ReservaService(UsuarioRepository usuarios, MesaRepository mesas, ReservaRepository reservas,
                          DataReservaValidator datas, Clock relogio) {
        this.usuarios = usuarios;
        this.mesas = mesas;
        this.reservas = reservas;
        this.datas = datas;
        this.relogio = relogio;
    }

    /**
     * Ordem global dos locks: usuário -> mesa. A linha da mesa protege inclusive a
     * primeira reserva. READ_COMMITTED garante que a consulta após aguardar o lock
     * enxergue o commit anterior. Toda criação deve passar por esta transação.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ReservaResponse criar(CriarReservaRequest request, UsuarioAutenticado autenticado) {
        if (autenticado == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Autenticação obrigatória.");
        }
        if (request == null || request.mesaId() == null || request.mesaId() <= 0) {
            throw new DadosInvalidosException("Campo 'mesaId' deve ser um inteiro positivo.");
        }
        datas.validar(request.data());

        var usuario = usuarios.buscarParaReserva(autenticado.id())
                .filter(u -> u.isAtivo())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário inativo ou inexistente."));
        var mesa = mesas.buscarParaReserva(request.mesaId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa " + request.mesaId() + " não encontrada."));
        // Revalida também a data: o request pode ter aguardado a liberação dos locks.
        datas.validar(request.data());
        if (!mesa.isAtiva()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mesa " + mesa.getCodigo() + " está inativa.");
        }
        if (mesa.getTipo() != TipoMesa.LIVRE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mesa " + mesa.getCodigo() + " é fixa e não pode ser reservada.");
        }
        if (reservas.mesaOcupadaNaData(mesa.getId(), request.data(), ReservaRepository.BLOQUEIA_MESA)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A mesa " + mesa.getCodigo() + " já possui uma reserva não cancelada em " + request.data() + ".");
        }
        if (reservas.usuarioTemReservaNaData(usuario.getId(), request.data(), ReservaRepository.BLOQUEIA_MESA)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Você já possui uma reserva em " + request.data().format(DATA_BR)
                            + ", para agendar outra mesa na mesma data é necessário cancelar a reserva atual.");
        }
        var reserva = new Reserva(mesa, usuario, request.data(), StatusReserva.CONFIRMADA);
        reserva.setConfirmadaEm(LocalDateTime.now(relogio));
        return ReservaResponse.de(reservas.saveAndFlush(reserva));
        // O proxy transacional efetua o commit antes de devolver o resultado ao controller.
    }
}

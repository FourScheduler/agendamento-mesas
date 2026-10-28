package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.response.ReservaResponse;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioSemPermissaoException;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Reserva;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import org.springframework.stereotype.Service;
import br.com.foursys.agendamento_mesas.dto.request.CriarReservaRequest;
import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.repository.UsuarioRepository;
import br.com.foursys.agendamento_mesas.security.UsuarioAutenticado;
import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ReservaService {
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private final UsuarioRepository usuarios;
    private final MesaRepositoryPort mesaRepositoryPort;
    private final ReservaRepositoryPort reservaRepositoryPort;
    private final DataReservaValidator datas;
    private final Clock relogio;

    public ReservaService(UsuarioRepository usuarios, MesaRepositoryPort mesaRepositoryPort,
                          ReservaRepositoryPort reservaRepositoryPort, DataReservaValidator datas, Clock relogio
    ) {
        this.usuarios = usuarios;
        this.mesaRepositoryPort = mesaRepositoryPort;
        this.reservaRepositoryPort = reservaRepositoryPort;
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

        Usuario usuario = usuarios.buscarParaReserva(autenticado.id())
                .filter(Usuario::isAtivo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário inativo ou inexistente."));

        Mesa mesa = mesaRepositoryPort.buscarParaReserva(request.mesaId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa " + request.mesaId() + " não encontrada."));

        // Revalida também a data: o request pode ter aguardado a liberação dos locks.
        datas.validar(request.data());
        if (!mesa.isAtiva()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mesa " + mesa.getCodigo() + " está inativa.");
        }

        if (mesa.getTipo() != TipoMesa.LIVRE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mesa " + mesa.getCodigo() + " é fixa e não pode ser reservada.");
        }

        if (reservaRepositoryPort.mesaOcupadaNaData(mesa.getId(), request.data(), ReservaRepositoryPort.BLOQUEIA_MESA)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A mesa " + mesa.getCodigo() + " já possui uma reserva não cancelada em " + request.data() + ".");
        }

        if (reservaRepositoryPort.usuarioTemReservaNaData(usuario.getId(), request.data(), ReservaRepositoryPort.BLOQUEIA_MESA)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Você já possui uma reserva em " + request.data().format(DATA_BR)
                            + ", para agendar outra mesa na mesma data é necessário cancelar a reserva atual.");
        }

        Reserva reserva = new Reserva(mesa, usuario, request.data(), StatusReserva.CONFIRMADA);
        reserva.setConfirmadaEm(LocalDateTime.now(relogio));
        return ReservaResponse.toResponse(reservaRepositoryPort.salvarESincronizar(reserva));
        // O proxy transacional efetua o commit antes de devolver o resultado ao controller.
    }

    public List<ReservaResponse> minhasReservas(Long usuarioId, LocalDate data, LocalDate dataInicio,
                                               LocalDate dataFim, StatusReserva status
    ) {
        if (data != null && (dataInicio != null || dataFim != null)) {
            throw new DadosInvalidosException("Use 'data' ou 'dataInicio'/'dataFim', sem combinar os filtros.");
        }

        if (dataInicio != null && dataFim != null && dataInicio.isAfter(dataFim)) {
            throw new DadosInvalidosException("'dataInicio' deve ser anterior ou igual a 'dataFim'.");
        }

        return reservaRepositoryPort
            .listarMinhas(usuarioId, data != null ? data : dataInicio, data != null ? data : dataFim, status)
            .stream()
            .map(ReservaResponse::toResponse)
            .toList();
    }

    public void cancelar(Long idReserva, UsuarioAutenticado usuarioAutenticado) {
        Reserva reserva = buscarReserva(idReserva);
        Mesa mesa = buscarMesa(reserva.getMesa().getId());

        if (!reserva.getUsuario().getId().equals(usuarioAutenticado.id())) {
            throw new UsuarioSemPermissaoException();
        }

        if (reserva.getStatus() == StatusReserva.CANCELADA) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Reserva " + idReserva + " já está cancelada.");
        }

        reserva.setCanceladaEm(LocalDateTime.now());
        reserva.setStatus(StatusReserva.CANCELADA);

        mesa.setAtiva(true);
        mesa.setTipo(TipoMesa.LIVRE);

        reservaRepositoryPort.salvar(reserva);
    }

    //Métodos Utilitários
    public Reserva buscarReserva(Long idReserva) {
        return reservaRepositoryPort.buscarPorId(idReserva)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reserva " + idReserva + " não encontrada."));
    }

    public Mesa buscarMesa(Long idMesa) {
        return mesaRepositoryPort.buscarPorId(idMesa)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa " + idMesa + " não encontrada."));
    }
}

package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.response.ReservaResponse;
import br.com.foursys.agendamento_mesas.exceptions.MesaNaoEncontradaException;
import br.com.foursys.agendamento_mesas.exceptions.ReservaJaCanceladaException;
import br.com.foursys.agendamento_mesas.exceptions.ReservaNaoEncontradaException;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioSemPermissaoException;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioComMesaFixaException;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Reserva;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import org.springframework.stereotype.Service;
import br.com.foursys.agendamento_mesas.dto.request.CriarReservaRequest;
import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;
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
    private final UsuarioRepositoryPort usuarioRepositoryPort;
    private final MesaRepositoryPort mesaRepositoryPort;
    private final ReservaRepositoryPort reservaRepositoryPort;
    private final DataReservaValidator datas;
    private final Clock relogio;

    public ReservaService(UsuarioRepositoryPort usuarioRepositoryPort, MesaRepositoryPort mesaRepositoryPort,
                          ReservaRepositoryPort reservaRepositoryPort, DataReservaValidator datas, Clock relogio
    ) {
        this.usuarioRepositoryPort = usuarioRepositoryPort;
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

        if (request != null && request.solicitanteId() != null
            && autenticado.perfil() != PerfilUsuario.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente administradores podem escolher o solicitante.");
        }

        if (request == null || request.mesaId() == null || request.mesaId() <= 0) {
            throw new DadosInvalidosException("Campo 'mesaId' deve ser um inteiro positivo.");
        }

        datas.validar(request.data());

        Long solicitanteId = request.solicitanteId() != null ? request.solicitanteId() : autenticado.id();
        Usuario usuario = usuarioRepositoryPort.buscarParaReserva(solicitanteId)
            .filter(Usuario::isAtivo)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitante inativo ou inexistente."));

        Mesa mesa = mesaRepositoryPort.buscarParaReserva(request.mesaId()).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa " + request.mesaId() + " não encontrada."));

        // Revalida também a data: o request pode ter aguardado a liberação dos locks.
        datas.validar(request.data());
        // O lock do beneficiário coordena este vínculo com atribuição e desfixação.
        // Mesmo um vínculo legado em mesa LIVRE bloqueia até ser removido.
        mesaRepositoryPort.buscarPorResponsavelId(usuario.getId()).ifPresent(vinculada -> {
            boolean reservaPropria = usuario.getId().equals(autenticado.id());
            String mensagem = reservaPropria
                ? "Você já possui a mesa fixa " + vinculada.getCodigo()
                    + " vinculada ao seu nome. Para reservar outra mesa, solicite à administração a remoção desse vínculo."
                : usuario.getNome() + " já possui a mesa fixa " + vinculada.getCodigo()
                    + " vinculada. Remova o vínculo antes de realizar uma reserva para essa pessoa.";
            throw new UsuarioComMesaFixaException(vinculada.getId(), vinculada.getCodigo(), mensagem);
        });

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
        reserva.setCriadoPor(autenticado.perfil() == PerfilUsuario.ADMIN && !usuario.getId().equals(autenticado.id())
            ? usuarioRepositoryPort.buscarPorId(autenticado.id())
                .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Administrador autenticado não encontrado."
                ))
            : usuario);
        reserva.setConfirmadaEm(LocalDateTime.now(relogio));
        return ReservaResponse.toResponse(reservaRepositoryPort.salvarESincronizar(reserva));
        // O proxy transacional efetua o commit antes de devolver o resultado ao controller.
    }

    public List<ReservaResponse> minhasReservas(
        Long usuarioId, LocalDate data, LocalDate dataInicio,
        LocalDate dataFim, StatusReserva status
    ) {
        validarFiltrosConsulta(data, dataInicio, dataFim);
        return reservaRepositoryPort
            .listarMinhas(usuarioId, data != null ? data : dataInicio, data != null ? data : dataFim, status)
            .stream()
            .map(ReservaResponse::toResponse)
            .toList();
    }

    public List<ReservaResponse> listarTodas(
        LocalDate data, LocalDate dataInicio, LocalDate dataFim, StatusReserva status
    ) {
        validarFiltrosConsulta(data, dataInicio, dataFim);
        return reservaRepositoryPort
            .listarTodas(data != null ? data : dataInicio, data != null ? data : dataFim, status)
            .stream()
            .map(ReservaResponse::toResponse)
            .toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void cancelar(Long idReserva, UsuarioAutenticado usuarioAutenticado) {
        if (usuarioAutenticado == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Autenticação obrigatória.");
        }
        usuarioRepositoryPort.buscarPorId(usuarioAutenticado.id())
            .filter(Usuario::isAtivo)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário inativo ou inexistente."));

        // Consulta escalar para não carregar a reserva antes da espera pelo lock.
        Long solicitanteId = reservaRepositoryPort.buscarUsuarioId(idReserva)
            .orElseThrow(() -> new ReservaNaoEncontradaException(idReserva));
        // A mesma ordem da criação: solicitante -> mesa, inclusive quando um admin cancela.
        usuarioRepositoryPort.buscarParaReserva(solicitanteId)
            .orElseThrow(() -> new ReservaNaoEncontradaException(idReserva));
        Reserva reserva = buscarReserva(idReserva);

        boolean administrador = usuarioAutenticado.perfil() == PerfilUsuario.ADMIN;
        boolean solicitante = reserva.getUsuario().getId().equals(usuarioAutenticado.id());
        boolean criadaPeloSolicitante = reserva.getCriadoPor() == null
            || reserva.getCriadoPor().getId().equals(usuarioAutenticado.id());
        if (!administrador && (!solicitante || !criadaPeloSolicitante)) {
            throw new UsuarioSemPermissaoException();
        }

        // Mantém consultas/criações/alterações administrativas coordenadas até o commit.
        mesaRepositoryPort.buscarParaReserva(reserva.getMesa().getId())
            .orElseThrow(MesaNaoEncontradaException::new);

        if (reserva.getStatus() == StatusReserva.CANCELADA) {
            throw new ReservaJaCanceladaException(idReserva);
        }

        reserva.setCanceladaEm(LocalDateTime.now(relogio));
        reserva.setStatus(StatusReserva.CANCELADA);

        reservaRepositoryPort.salvarESincronizar(reserva);
    }

    private void validarFiltrosConsulta(
        LocalDate data, LocalDate dataInicio, LocalDate dataFim
    ) {
        if (data != null && (dataInicio != null || dataFim != null)) {
            throw new DadosInvalidosException("Use 'data' ou 'dataInicio'/'dataFim', sem combinar os filtros.");
        }

        if (dataInicio != null && dataFim != null && dataInicio.isAfter(dataFim)) {
            throw new DadosInvalidosException("'dataInicio' deve ser anterior ou igual a 'dataFim'.");
        }
    }

    //Métodos Utilitários
    public Reserva buscarReserva(Long idReserva) {
        return reservaRepositoryPort.buscarPorId(idReserva)
                .orElseThrow(() -> new ReservaNaoEncontradaException(idReserva));
    }

    public Mesa buscarMesa(Long idMesa) {
        return mesaRepositoryPort.buscarPorId(idMesa)
            .orElseThrow(MesaNaoEncontradaException::new);
    }
}

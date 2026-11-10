package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.response.ReservaResponse;
import br.com.foursys.agendamento_mesas.dto.response.PaginaResponse;
import br.com.foursys.agendamento_mesas.exceptions.MesaNaoEncontradaException;
import br.com.foursys.agendamento_mesas.exceptions.ReservaJaCanceladaException;
import br.com.foursys.agendamento_mesas.exceptions.ReservaNaoEncontradaException;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioSemPermissaoException;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioComMesaFixaException;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioComReservaNaDataException;
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
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.HashMap;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

@Service
public class ReservaService {
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
        return criar(request, autenticado, null);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ReservaResponse criar(CriarReservaRequest request, UsuarioAutenticado autenticado, String chaveRequisicao) {
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

        Long solicitanteId = request.solicitanteId() != null ? request.solicitanteId() : autenticado.id();
        if (solicitanteId <= 0) throw new DadosInvalidosException("Solicitante deve ser um inteiro positivo.");
        String chave = chaveRequisicao == null ? null : validarChave(chaveRequisicao);
        // Inclui o autor antes da mesa: a FK criado_por_id também pode adquirir lock no MySQL.
        var usuarios = new HashMap<Long, Usuario>();
        Stream.of(autenticado.id(), solicitanteId).distinct().sorted().forEach(id -> {
            Usuario bloqueado = usuarioRepositoryPort.buscarParaReserva(id)
                .filter(Usuario::isAtivo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitante inativo ou inexistente."));
            usuarios.put(id, bloqueado);
        });
        Usuario usuario = usuarios.get(solicitanteId);
        if (chave != null) {
            var existente = reservaRepositoryPort.buscarPorAutorEChave(autenticado.id(), chave);
            if (existente.isPresent()) {
                Reserva reserva = existente.get();
                if (!Objects.equals(reserva.getMesa().getId(), request.mesaId())
                    || !Objects.equals(reserva.getData(), request.data())
                    || !Objects.equals(reserva.getUsuario().getId(), solicitanteId)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Chave de confirmação já utilizada para outra reserva.");
                }
                return ReservaResponse.toResponse(reserva);
            }
        }
        datas.validar(request.data());

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

        reservaRepositoryPort.buscarReservaDoUsuarioNaData(usuario.getId(), request.data(),
            ReservaRepositoryPort.BLOQUEIA_MESA).ifPresent(existente -> {
                Mesa mesaExistente = existente.getMesa();
                throw new UsuarioComReservaNaDataException(mesaExistente.getId(), mesaExistente.getCodigo());
            });

        if (reservaRepositoryPort.mesaOcupadaNaData(mesa.getId(), request.data(), ReservaRepositoryPort.BLOQUEIA_MESA)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "A mesa " + mesa.getCodigo() + " já possui uma reserva não cancelada em " + request.data() + ".");
        }

        Reserva reserva = new Reserva(mesa, usuario, request.data(), StatusReserva.CONFIRMADA);
        reserva.setCriadoPor(usuarios.get(autenticado.id()));
        reserva.setChaveRequisicao(chave);
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

    @Transactional(readOnly = true)
    public PaginaResponse<ReservaResponse> listarPagina(Long usuarioId, LocalDate inicio, LocalDate fim,
            StatusReserva status, boolean canceladas, int pagina, int tamanho) {
        validarFiltrosConsulta(null, inicio, fim);
        if (pagina < 0 || tamanho < 1 || tamanho > 100) {
            throw new DadosInvalidosException("Página deve ser não negativa e tamanho deve estar entre 1 e 100.");
        }
        if (status != null && canceladas != (status == StatusReserva.CANCELADA)) {
            throw new DadosInvalidosException("Status incompatível com a situação selecionada.");
        }
        var estados = status != null ? List.of(status)
            : canceladas ? List.of(StatusReserva.CANCELADA) : List.copyOf(ReservaRepositoryPort.BLOQUEIA_MESA);
        var direcao = canceladas ? Sort.Direction.DESC : Sort.Direction.ASC;
        var resultado = reservaRepositoryPort.listarPagina(usuarioId, inicio, fim, estados,
            PageRequest.of(pagina, tamanho, Sort.by(direcao, "data", "id")));
        return PaginaResponse.de(resultado.map(ReservaResponse::toResponse));
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
        if (!administrador && !solicitante) {
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

    @Transactional(readOnly = true)
    public ReservaResponse consultarConfirmacao(String chave, UsuarioAutenticado usuario) {
        return reservaRepositoryPort.buscarPorAutorEChave(usuario.id(), validarChave(chave))
            .map(ReservaResponse::toResponse)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Confirmação ainda não localizada."));
    }

    private String validarChave(String chave) {
        try {
            String normalizada = UUID.fromString(chave).toString();
            if (!normalizada.equalsIgnoreCase(chave)) throw new IllegalArgumentException();
            return normalizada;
        } catch (IllegalArgumentException e) {
            throw new DadosInvalidosException("Idempotency-Key deve ser um UUID válido.");
        }
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

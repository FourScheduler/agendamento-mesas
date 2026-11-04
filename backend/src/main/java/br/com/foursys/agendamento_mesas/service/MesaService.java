package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.response.MesaComOcupacaoResponse;
import br.com.foursys.agendamento_mesas.dto.response.MesaResponse;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Reserva;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;

import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class MesaService {
    private final DataReservaValidator datas;
    private final MesaRepositoryPort mesaRepositoryPort;
    private final UsuarioRepositoryPort usuarioRepositoryPort;
    private final ReservaRepositoryPort reservaRepositoryPort;
    private final Clock relogio;

    public MesaService(
        DataReservaValidator datas,
        MesaRepositoryPort mesaRepositoryPort,
        UsuarioRepositoryPort usuarioRepositoryPort,
        ReservaRepositoryPort reservaRepositoryPort,
        Clock relogio
    ) {
        this.datas = datas;
        this.mesaRepositoryPort = mesaRepositoryPort;
        this.usuarioRepositoryPort = usuarioRepositoryPort;
        this.reservaRepositoryPort = reservaRepositoryPort;
        this.relogio = relogio;
    }

    public List<MesaResponse> listar() {
        return mesaRepositoryPort
            .buscarTodosPorCodigoAsc()
            .stream().map(MesaResponse::de)
            .toList();
    }

    public List<MesaResponse> listar(String termo) {
        if (termo == null || termo.isBlank()) {
            return listar();
        }

        String termoNormalizado = termo.replaceAll("\\D", "");
        if (termoNormalizado.isEmpty()) {
            return listar();
        }

        return mesaRepositoryPort.buscarPorTrechoCodigoAsc(termoNormalizado)
            .stream().map(MesaResponse::de).toList();
    }

    /**
     * Elegibilidade do catálogo. O fluxo de reserva deve ainda validar o período e conflitos.
     */
    public Mesa obterParaReserva(Long id) {
        Mesa mesa = mesaRepositoryPort.buscarPorId(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa " + id + " não encontrada."));

        if (!mesa.isAtiva()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mesa " + mesa.getCodigo() + " está inativa.");
        }

        if (mesa.getTipo() != TipoMesa.LIVRE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Mesa " + mesa.getCodigo() + " é fixa e não pode ser reservada.");
        }

        return mesa;
    }

    public List<MesaResponse> listarDisponiveis(LocalDate data) {

        datas.validar(data);

        return mesaRepositoryPort
            .buscarMesasDisponiveis(data, TipoMesa.LIVRE, ReservaRepositoryPort.BLOQUEIA_MESA)
            .stream()
            .map(MesaResponse::de)
            .toList();
    }

    public List<MesaComOcupacaoResponse> listarComOcupacao(LocalDate data, String termo) {
        var mesas = listar(termo);
        if (mesas.isEmpty()) return List.of();
        var ocupacoes = new HashMap<Long, Reserva>();
        for (var reserva : reservaRepositoryPort.buscarOcupacoesNaData(data,
                mesas.stream().map(MesaResponse::id).toList(), ReservaRepositoryPort.BLOQUEIA_MESA)) {
            // O fluxo de criação garante uma reserva válida por mesa/dia.
            // Para duplicidade legada, a consulta ordena por ID decrescente.
            ocupacoes.putIfAbsent(reserva.getMesa().getId(), reserva);
        }
        return mesas.stream()
            .map(mesa -> MesaComOcupacaoResponse.de(mesa, ocupacoes.get(mesa.id())))
            .toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MesaResponse fixar(Long id, Long usuarioId) {
        validarUsuarioId(usuarioId);
        var alteracao = bloquearResponsaveisEMesa(id, usuarioId);
        Usuario responsavel = alteracao.novoResponsavel();
        Mesa mesa = alteracao.mesa();
        validarMesaAtivaParaFixacao(mesa);
        if (mesa.getTipo() == TipoMesa.FIXA) {
            throw conflito("Mesa " + mesa.getCodigo() + " já está fixa.");
        }

        validarResponsavelUnico(usuarioId, id);
        validarMesaSemReservas(mesa);
        validarUsuarioSemReservas(usuarioId);
        mesa.setTipo(TipoMesa.FIXA);
        mesa.setResponsavel(responsavel);
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MesaResponse desfixar(Long id) {
        Mesa mesa = bloquearResponsaveisEMesa(id, null).mesa();
        if (mesa.getTipo() != TipoMesa.FIXA) {
            throw conflito("Mesa " + mesa.getCodigo() + " não está fixa.");
        }

        mesa.setTipo(TipoMesa.LIVRE);
        mesa.setResponsavel(null);
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MesaResponse alterarResponsavel(Long id, Long usuarioId) {
        validarUsuarioId(usuarioId);
        var alteracao = bloquearResponsaveisEMesa(id, usuarioId);
        Usuario responsavel = alteracao.novoResponsavel();
        Mesa mesa = alteracao.mesa();
        validarMesaAtivaParaFixacao(mesa);
        if (mesa.getTipo() != TipoMesa.FIXA) {
            throw conflito("Somente mesas fixas podem ter responsável.");
        }

        validarResponsavelUnico(usuarioId, id);
        if (Objects.equals(idResponsavel(mesa), usuarioId)) {
            return MesaResponse.de(mesa);
        }
        validarMesaSemReservas(mesa);
        validarUsuarioSemReservas(usuarioId);
        mesa.setResponsavel(responsavel);
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MesaResponse alterarTipo(Long id, TipoMesa tipo) {
        if (tipo == null) {
            throw new DadosInvalidosException("Campo 'tipo' é obrigatório.");
        }

        Mesa mesa = bloquearResponsaveisEMesa(id, null).mesa();
        if (tipo == TipoMesa.FIXA) {
            validarMesaAtivaParaFixacao(mesa);
            if (mesa.getTipo() != TipoMesa.FIXA) {
                validarMesaSemReservas(mesa);
                if (mesa.getResponsavel() != null) validarUsuarioSemReservas(idResponsavel(mesa));
            }
        }
        mesa.setTipo(tipo);
        if (tipo == TipoMesa.LIVRE) {
            mesa.setResponsavel(null);
        }
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MesaResponse alterarAtivacao(Long id, Boolean ativa) {
        if (ativa == null) {
            throw new DadosInvalidosException("Campo 'ativa' é obrigatório.");
        }

        Mesa mesa = obterPorIdComBloqueio(id);
        if (!ativa && mesa.getResponsavel() != null) {
            throw conflito("Mesa " + mesa.getCodigo()
                + " possui um responsável vinculado. Remova o vínculo antes de inativá-la.");
        }
        if (!ativa) validarMesaSemReservas(mesa);
        mesa.setAtiva(ativa);
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    private record AlteracaoResponsavel(Mesa mesa, Usuario novoResponsavel) {}

    private AlteracaoResponsavel bloquearResponsaveisEMesa(Long id, Long novoResponsavelId) {
        // Consulta escalar: não coloca uma Mesa possivelmente obsoleta no contexto JPA.
        Long anteriorId = mesaRepositoryPort.buscarResponsavelId(id).orElse(null);
        Usuario novoResponsavel = null;
        for (Long usuarioId : Stream.of(anteriorId, novoResponsavelId)
                .filter(Objects::nonNull).distinct().sorted().toList()) {
            Usuario usuario = usuarioRepositoryPort.buscarParaReserva(usuarioId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
            if (usuarioId.equals(novoResponsavelId)) {
                if (!usuario.isAtivo()) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário ativo não encontrado.");
                }
                novoResponsavel = usuario;
            }
        }
        Mesa mesa = obterPorIdComBloqueio(id);
        // Não adquirir um usuário novo depois da mesa: isso inverteria a ordem dos locks.
        if (!Objects.equals(anteriorId, idResponsavel(mesa))) {
            throw conflito("O responsável da mesa foi alterado por outra operação. Atualize os dados e tente novamente.");
        }
        return new AlteracaoResponsavel(mesa, novoResponsavel);
    }

    private Long idResponsavel(Mesa mesa) {
        return mesa.getResponsavel() == null ? null : mesa.getResponsavel().getId();
    }

    private void validarMesaSemReservas(Mesa mesa) {
        if (reservaRepositoryPort.mesaTemReservasDesde(mesa.getId(), LocalDate.now(relogio),
                ReservaRepositoryPort.BLOQUEIA_MESA)) {
            throw conflito("Mesa " + mesa.getCodigo()
                + " possui reservas não canceladas de hoje em diante. Revise as reservas antes de alterar a mesa.");
        }
    }

    private void validarUsuarioSemReservas(Long usuarioId) {
        if (reservaRepositoryPort.usuarioTemReservasDesde(usuarioId, LocalDate.now(relogio),
                ReservaRepositoryPort.BLOQUEIA_MESA)) {
            throw conflito("O usuário possui reservas não canceladas de hoje em diante e não pode receber uma mesa fixa.");
        }
    }

    private Mesa obterPorIdComBloqueio(Long id) {
        return mesaRepositoryPort.buscarParaReserva(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa " + id + " não encontrada."));
    }

    private void validarResponsavelUnico(Long usuarioId, Long mesaId) {
        if (mesaRepositoryPort.existeOutraMesaPorResponsavelId(usuarioId, mesaId)) {
            throw conflito("O usuário já possui uma mesa fixa vinculada. Desfixe a mesa atual antes de atribuir outra.");
        }
    }

    private void validarMesaAtivaParaFixacao(Mesa mesa) {
        if (!mesa.isAtiva()) {
            throw conflito("Mesa " + mesa.getCodigo()
                + " está inativa. Ative a mesa antes de fixá-la ou atribuir um responsável.");
        }
    }

    private void validarUsuarioId(Long usuarioId) {
        if (usuarioId == null || usuarioId <= 0) {
            throw new DadosInvalidosException("Campo 'usuarioId' deve ser um inteiro positivo.");
        }
    }

    private ResponseStatusException conflito(String mensagem) {
        return new ResponseStatusException(HttpStatus.CONFLICT, mensagem);
    }
}

package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.request.AlterarAtivacaoMesaRequest;
import br.com.foursys.agendamento_mesas.dto.request.AtribuirResponsavelRequest;
import br.com.foursys.agendamento_mesas.dto.response.MesaAdminResponse;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.infrastructure.persistence.repository.UsuarioJpaRepository;
import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(isolation = Isolation.READ_COMMITTED)
public class MesaAdminService {
    private final MesaRepositoryPort mesas;
    private final ReservaRepositoryPort reservas;
    private final UsuarioJpaRepository usuarios;
    private final Clock relogio;

    public MesaAdminService(MesaRepositoryPort mesas, ReservaRepositoryPort reservas,
                            UsuarioRepository usuarios, Clock relogio) {
        this.mesas = mesas;
        this.reservas = reservas;
        this.usuarios = usuarios;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public List<MesaAdminResponse> listar() {
        return mesas.buscarTodosComResponsavelPorCodigoAsc().stream().map(MesaAdminResponse::de).toList();
    }

    public MesaAdminResponse atribuir(Long mesaId, AtribuirResponsavelRequest request) {
        validarId(mesaId);
        if (request == null || request.usuarioId() == null || request.usuarioId() <= 0) {
            throw new DadosInvalidosException("Campo 'usuarioId' deve ser um inteiro positivo.");
        }
        // Lê apenas o ID, evitando manter uma Mesa desatualizada no contexto JPA antes do lock.
        Long anterior = mesas.buscarResponsavelId(mesaId).orElse(null);
        Map<Long, Usuario> bloqueados = bloquearUsuarios(anterior, request.usuarioId());
        Mesa mesa = bloquearMesa(mesaId);
        validarResponsavelObservado(mesa, anterior);
        Usuario novo = bloqueados.get(request.usuarioId());
        if (!mesa.isAtiva()) throw conflito("Ative a mesa antes de atribuir um responsável.");
        if (!novo.isAtivo()) throw conflito("O usuário selecionado está inativo.");
        if (Objects.equals(anterior, novo.getId())) return MesaAdminResponse.de(mesa);
        mesas.buscarPorResponsavelId(novo.getId()).ifPresent(outra -> {
            throw conflito("O usuário selecionado já possui a mesa fixa " + outra.getCodigo() + ".");
        });
        validarReservasDaMesa(mesaId);
        if (reservas.usuarioTemReservasDesde(novo.getId(), hoje(), ReservaRepositoryPort.BLOQUEIA_MESA)) {
            throw conflito("O usuário selecionado possui reservas de hoje em diante. Resolva-as antes de atribuir uma mesa fixa.");
        }
        mesa.setResponsavel(novo);
        mesa.setTipo(TipoMesa.FIXA);
        mesas.salvarESincronizar(mesa);
        return MesaAdminResponse.de(mesa);
    }

    public MesaAdminResponse desfixar(Long mesaId) {
        validarId(mesaId);
        Long anterior = mesas.buscarResponsavelId(mesaId).orElse(null);
        bloquearUsuarios(anterior);
        Mesa mesa = bloquearMesa(mesaId);
        validarResponsavelObservado(mesa, anterior);
        mesa.setResponsavel(null);
        mesa.setTipo(TipoMesa.LIVRE);
        mesas.salvarESincronizar(mesa);
        return MesaAdminResponse.de(mesa);
    }

    public MesaAdminResponse alterarAtivacao(Long mesaId, AlterarAtivacaoMesaRequest request) {
        validarId(mesaId);
        if (request == null || request.ativa() == null) {
            throw new DadosInvalidosException("Campo 'ativa' é obrigatório e deve ser booleano.");
        }
        Mesa mesa = bloquearMesa(mesaId);
        if (!request.ativa()) {
            if (mesa.getResponsavel() != null) {
                throw conflito("Remova o responsável da mesa antes de inativá-la.");
            }
            validarReservasDaMesa(mesaId);
        }
        mesa.setAtiva(request.ativa());
        mesas.salvarESincronizar(mesa);
        return MesaAdminResponse.de(mesa);
    }

    private Map<Long, Usuario> bloquearUsuarios(Long... ids) {
        Map<Long, Usuario> resultado = new HashMap<>();
        // Todas as escritas seguem usuários em ordem de ID -> mesa, como a reserva comum.
        Stream.of(ids).filter(Objects::nonNull).distinct().sorted().forEach(id -> {
            Usuario usuario = usuarios.buscarParaReserva(id).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário " + id + " não encontrado."));
            resultado.put(id, usuario);
        });
        return resultado;
    }

    private Mesa bloquearMesa(Long id) {
        return mesas.buscarParaReserva(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa " + id + " não encontrada."));
    }

    private void validarResponsavelObservado(Mesa mesa, Long anterior) {
        Long atual = mesa.getResponsavel() == null ? null : mesa.getResponsavel().getId();
        // Se mudou enquanto esperávamos, não adquirir outro usuário após bloquear a mesa.
        if (!Objects.equals(atual, anterior)) {
            throw conflito("O responsável da mesa foi alterado por outra operação. Atualize os dados e tente novamente.");
        }
    }

    private void validarReservasDaMesa(Long id) {
        if (reservas.mesaTemReservasDesde(id, hoje(), ReservaRepositoryPort.BLOQUEIA_MESA)) {
            throw conflito("A mesa possui reservas de hoje em diante. Resolva-as antes de fixar ou inativar a mesa.");
        }
    }

    private LocalDate hoje() {
        return LocalDate.now(relogio.withZone(ZoneId.of("America/Sao_Paulo")));
    }

    private void validarId(Long id) {
        if (id == null || id <= 0) throw new DadosInvalidosException("O identificador da mesa deve ser positivo.");
    }

    private ResponseStatusException conflito(String mensagem) {
        return new ResponseStatusException(HttpStatus.CONFLICT, mensagem);
    }
}

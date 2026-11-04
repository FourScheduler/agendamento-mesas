package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.response.MesaComOcupacaoResponse;
import br.com.foursys.agendamento_mesas.dto.response.MesaResponse;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;

import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class MesaService {
    private final DataReservaValidator datas;
    private final MesaRepositoryPort mesaRepositoryPort;
    private final UsuarioRepositoryPort usuarioRepositoryPort;
    private final ReservaRepositoryPort reservaRepositoryPort;

    public MesaService(
        DataReservaValidator datas,
        MesaRepositoryPort mesaRepositoryPort,
        UsuarioRepositoryPort usuarioRepositoryPort,
        ReservaRepositoryPort reservaRepositoryPort
    ) {
        this.datas = datas;
        this.mesaRepositoryPort = mesaRepositoryPort;
        this.usuarioRepositoryPort = usuarioRepositoryPort;
        this.reservaRepositoryPort = reservaRepositoryPort;
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
        return listar(termo).stream()
            .map(mesa -> MesaComOcupacaoResponse.de(mesa,
                reservaRepositoryPort.mesaOcupadaNaData(mesa.id(), data, ReservaRepositoryPort.BLOQUEIA_MESA)))
            .toList();
    }

    @Transactional
    public MesaResponse fixar(Long id, Long usuarioId) {
        Mesa mesa = obterPorId(id);
        validarUsuarioId(usuarioId);
        if (mesa.getTipo() == TipoMesa.FIXA) {
            throw conflito("Mesa " + mesa.getCodigo() + " já está fixa.");
        }

        mesa.setTipo(TipoMesa.FIXA);
        mesa.setResponsavel(obterUsuarioAtivo(usuarioId));
        mesa.setOcupante(obterUsuarioAtivo(usuarioId).getNome());
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    @Transactional
    public MesaResponse desfixar(Long id) {
        Mesa mesa = obterPorId(id);
        if (mesa.getTipo() != TipoMesa.FIXA) {
            throw conflito("Mesa " + mesa.getCodigo() + " não está fixa.");
        }

        mesa.setTipo(TipoMesa.LIVRE);
        mesa.setOcupante(null);
        mesa.setResponsavel(null);
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    @Transactional
    public MesaResponse alterarResponsavel(Long id, Long usuarioId) {
        Mesa mesa = obterPorId(id);
        validarUsuarioId(usuarioId);
        if (mesa.getTipo() != TipoMesa.FIXA) {
            throw conflito("Somente mesas fixas podem ter responsável.");
        }

        mesa.setResponsavel(obterUsuarioAtivo(usuarioId));
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    @Transactional
    public MesaResponse alterarTipo(Long id, TipoMesa tipo) {
        if (tipo == null) {
            throw new DadosInvalidosException("Campo 'tipo' é obrigatório.");
        }

        Mesa mesa = obterPorId(id);
        mesa.setTipo(tipo);
        if (tipo == TipoMesa.LIVRE) {
            mesa.setResponsavel(null);
        }
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    @Transactional
    public MesaResponse alterarAtivacao(Long id, Boolean ativa) {
        if (ativa == null) {
            throw new DadosInvalidosException("Campo 'ativa' é obrigatório.");
        }

        Mesa mesa = obterPorId(id);
        mesa.setAtiva(ativa);
        return MesaResponse.de(mesaRepositoryPort.salvar(mesa));
    }

    private Mesa obterPorId(Long id) {
        return mesaRepositoryPort.buscarPorId(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa " + id + " não encontrada."));
    }

    private Usuario obterUsuarioAtivo(Long usuarioId) {
        Usuario usuario = usuarioRepositoryPort.buscarPorId(usuarioId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário ativo não encontrado."));
        if (!usuario.isAtivo()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário ativo não encontrado.");
        }
        return usuario;
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

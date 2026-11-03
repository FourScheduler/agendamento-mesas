package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.dto.response.MesaResponse;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;

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

    public MesaService(DataReservaValidator datas, MesaRepositoryPort mesaRepositoryPort) {
        this.datas = datas;
        this.mesaRepositoryPort = mesaRepositoryPort;
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
}

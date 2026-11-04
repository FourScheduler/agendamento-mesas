package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.dto.response.MesaComOcupacaoResponse;
import br.com.foursys.agendamento_mesas.dto.response.MesaResponse;
import br.com.foursys.agendamento_mesas.service.MesaService;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mesas")
public class MesaController {

    private final MesaService mesasService;
    private final Clock relogio;

    public MesaController(MesaService mesas, Clock relogio) {
        this.mesasService = mesas;
        this.relogio = relogio;
    }

    @GetMapping
    public List<MesaResponse> listar(@RequestParam(required = false) String termo) {
        return mesasService.listar(termo);
    }

    @GetMapping("/disponiveis")
    public ResponseEntity<List<MesaResponse>> listarDisponiveis(
        @RequestParam LocalDate data
    ) {

        List<MesaResponse> listaMesasDisponiveis =
            mesasService.listarDisponiveis(data);

        return ResponseEntity
            .status(HttpStatus.OK)
            .body(listaMesasDisponiveis);
    }

    @GetMapping("/com-ocupacao")
    public ResponseEntity<List<MesaComOcupacaoResponse>> listarComOcupacao(
        @RequestParam(required = false) LocalDate data,
        @RequestParam(required = false) String termo
    ) {
        LocalDate dataConsulta = data != null ? data : LocalDate.now(relogio);
        List<MesaComOcupacaoResponse> lista = mesasService.listarComOcupacao(dataConsulta, termo);
        return ResponseEntity.ok(lista);
    }
}

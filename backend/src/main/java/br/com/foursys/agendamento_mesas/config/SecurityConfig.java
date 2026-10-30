package br.com.foursys.agendamento_mesas.config;

import br.com.foursys.agendamento_mesas.security.AcessoNegadoTratador;
import br.com.foursys.agendamento_mesas.security.EntradaNaoAutenticado;
import br.com.foursys.agendamento_mesas.security.JwtAuthenticationFilter;
import br.com.foursys.agendamento_mesas.security.JwtService;
import br.com.foursys.agendamento_mesas.security.UsuarioPorTokenService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtService jwtService;
    private final UsuarioPorTokenService usuarioPorTokenService;

    public SecurityConfig(JwtService jwtService, UsuarioPorTokenService usuarioPorTokenService) {
        this.jwtService = jwtService;
        this.usuarioPorTokenService = usuarioPorTokenService;
    }

    @Bean
    public SecurityFilterChain filtroSeguranca(HttpSecurity http) throws Exception {
        JwtAuthenticationFilter filtroJwt = new JwtAuthenticationFilter(jwtService, usuarioPorTokenService);
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> {})
            .sessionManagement(sessao -> sessao.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(requisicoes -> requisicoes
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .exceptionHandling(erros -> erros
                .authenticationEntryPoint(new EntradaNaoAutenticado())
                .accessDeniedHandler(new AcessoNegadoTratador()))
            .addFilterBefore(filtroJwt, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}

package com.sochi.vayu.service;

import com.sochi.vayu.config.JwtTokenProvider;
import com.sochi.vayu.domain.User;
import com.sochi.vayu.dto.LoginRequestDto;
import com.sochi.vayu.dto.LoginResponseDto;
import com.sochi.vayu.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AuthServiceTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private JwtTokenProvider jwtTokenProvider;
    private AuditLogService auditLogService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtTokenProvider = mock(JwtTokenProvider.class);
        auditLogService = mock(AuditLogService.class);

        authService = new AuthService(
                userRepository,
                passwordEncoder,
                jwtTokenProvider,
                auditLogService
        );
    }

    @Test
    @DisplayName("Should issue JWT token and record audit log on valid login credentials")
    void testLoginSuccess() {
        User user = new User("admin", "hashed_pwd", "SOCHI Admin", "ROLE_ADMIN", "*", true);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("SochiAdmin2026!", "hashed_pwd")).thenReturn(true);
        when(jwtTokenProvider.generateToken(user)).thenReturn("mock.jwt.token");
        when(jwtTokenProvider.getExpirationMs()).thenReturn(86400000L);

        LoginRequestDto req = new LoginRequestDto("admin", "SochiAdmin2026!");
        LoginResponseDto response = authService.login(req);

        assertNotNull(response);
        assertEquals("mock.jwt.token", response.getToken());
        assertEquals("admin", response.getUsername());
        assertEquals("ROLE_ADMIN", response.getRole());
        assertEquals("*", response.getSiteScope());

        verify(auditLogService, times(1)).logAction(
                eq("admin"),
                eq("LOGIN_SUCCESS"),
                eq("USER"),
                eq("admin"),
                any()
        );
    }

    @Test
    @DisplayName("Should reject and log audit event when password does not match")
    void testLoginInvalidPassword() {
        User user = new User("tech_pune", "hashed_pwd", "Pune Tech", "ROLE_SERVICE_TECH", "SITE-HQ-PUNE", true);
        when(userRepository.findByUsername("tech_pune")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("WrongPassword", "hashed_pwd")).thenReturn(false);

        LoginRequestDto req = new LoginRequestDto("tech_pune", "WrongPassword");

        assertThrows(BadCredentialsException.class, () -> authService.login(req));

        verify(auditLogService, times(1)).logAction(
                eq("tech_pune"),
                eq("LOGIN_FAILED"),
                eq("USER"),
                eq("tech_pune"),
                any()
        );
    }

    @Test
    @DisplayName("Should reject and log audit event when user is disabled")
    void testLoginDisabledUser() {
        User user = new User("disabled_user", "hashed_pwd", "Inactive User", "ROLE_KIOSK", "*", false);
        when(userRepository.findByUsername("disabled_user")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("pass123", "hashed_pwd")).thenReturn(true);

        LoginRequestDto req = new LoginRequestDto("disabled_user", "pass123");

        assertThrows(BadCredentialsException.class, () -> authService.login(req));

        verify(auditLogService, times(1)).logAction(
                eq("disabled_user"),
                eq("LOGIN_DENIED"),
                eq("USER"),
                eq("disabled_user"),
                any()
        );
    }
}

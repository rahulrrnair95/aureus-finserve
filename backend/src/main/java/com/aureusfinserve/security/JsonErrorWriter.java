package com.aureusfinserve.security;

import com.aureusfinserve.common.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;

import java.io.IOException;

/** Writes the contract error JSON from servlet filters (outside of Spring MVC). */
public final class JsonErrorWriter {

    private JsonErrorWriter() {
    }

    public static void write(HttpServletResponse res, ObjectMapper mapper, int status, String code, String message)
            throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        mapper.writeValue(res.getOutputStream(), new ErrorResponse(message, code));
    }
}

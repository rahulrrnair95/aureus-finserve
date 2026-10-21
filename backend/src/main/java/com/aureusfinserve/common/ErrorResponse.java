package com.aureusfinserve.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String error, String code, Map<String, String> fields) {
    public ErrorResponse(String error, String code) {
        this(error, code, null);
    }
}

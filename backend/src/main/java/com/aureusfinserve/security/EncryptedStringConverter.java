package com.aureusfinserve.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Transparent AES-256-GCM encryption for sensitive String columns (PAN, mobile, DOB, bank account no.). */
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return attribute == null ? null : CryptoService.instance().encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return dbData == null ? null : CryptoService.instance().decrypt(dbData);
    }
}

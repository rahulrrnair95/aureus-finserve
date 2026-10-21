package com.aureusfinserve.kyc;

import com.aureusfinserve.common.KycDocType;

import java.time.LocalDateTime;

/** Document metadata without the (encrypted) file bytes. */
public record KycDocumentMeta(Long id, Long applicationId, KycDocType docType, String fileName, String contentType,
                              long sizeBytes, LocalDateTime uploadedAt) {
}

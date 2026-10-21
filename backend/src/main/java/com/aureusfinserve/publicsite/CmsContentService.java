package com.aureusfinserve.publicsite;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.publicsite.PublicRepos.CmsContentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/** Typed access to JSON CMS documents in cms_content. */
@Service
@RequiredArgsConstructor
public class CmsContentService {

    private final CmsContentRepository repo;
    private final ObjectMapper mapper;

    public <T> Optional<T> get(String key, Class<T> type) {
        return repo.findById(key).map(c -> {
            try {
                return mapper.readValue(c.getJson(), type);
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Corrupt CMS document " + key, e);
            }
        });
    }

    @Transactional
    public <T> T put(String key, T value) {
        CmsContent c = repo.findById(key).orElseGet(() -> {
            CmsContent n = new CmsContent();
            n.setKey(key);
            return n;
        });
        try {
            c.setJson(mapper.writeValueAsString(value));
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Cannot serialise CMS document", e);
        }
        c.setUpdatedAt(Fmt.now());
        repo.save(c);
        return value;
    }

    public java.util.List<CmsContent> byPrefix(String prefix) {
        return repo.findByKeyStartingWith(prefix);
    }
}

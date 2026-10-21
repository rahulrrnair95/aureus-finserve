package com.aureusfinserve.nfo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public final class NfoRepos {

    private NfoRepos() {
    }

    public interface NfoRepository extends JpaRepository<Nfo, Long> {
        List<Nfo> findAllByOrderByOpenDateDescIdDesc();
    }

    public interface NfoOnePagerRepository extends JpaRepository<NfoOnePager, Long> {
    }
}

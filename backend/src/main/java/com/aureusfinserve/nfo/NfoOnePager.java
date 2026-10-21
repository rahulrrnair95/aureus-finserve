package com.aureusfinserve.nfo;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

/** PDF one-pager (NFO leaflet) of an NFO, uploaded by staff. Separate table so NFO lists never load the bytes. */
@Getter
@Setter
@Entity
@Table(name = "nfo_one_pager")
public class NfoOnePager {

    /** Same as nfo.id (one file per NFO). */
    @Id
    @Column(name = "nfo_id")
    private Long nfoId;

    /** PDF bytes (VARBINARY(MAX) on SQL Server). */
    @Column(nullable = false, length = Length.LONG32)
    private byte[] data;
}

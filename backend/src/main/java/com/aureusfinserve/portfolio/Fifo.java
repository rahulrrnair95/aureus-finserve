package com.aureusfinserve.portfolio;

import com.aureusfinserve.common.TxnType;

import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Replays a folio's transactions in date order with FIFO lot matching.
 * Inflows (purchase / SIP / switch-in / STP-in) create lots; outflows consume the oldest lots first
 * and produce realised slices used for the capital-gains report.
 */
public final class Fifo {

    private static final double EPS = 1e-6;

    public static final class Lot {
        public final LocalDate date;
        public double units;
        public final double costPerUnit;

        Lot(LocalDate date, double units, double costPerUnit) {
            this.date = date;
            this.units = units;
            this.costPerUnit = costPerUnit;
        }
    }

    public record Realised(LocalDate purchaseDate, LocalDate saleDate, double units, double cost, double sale,
                           TxnType saleType) {
    }

    public static final class State {
        public final Deque<Lot> lots = new ArrayDeque<>();
        public final List<Realised> realised = new ArrayList<>();

        public double units() {
            return lots.stream().mapToDouble(l -> l.units).sum();
        }

        public double cost() {
            return lots.stream().mapToDouble(l -> l.units * l.costPerUnit).sum();
        }
    }

    private Fifo() {
    }

    /** @param txns sorted by date ascending; @param upTo inclusive cut-off or null for all. */
    public static State replay(List<MfTransaction> txns, LocalDate upTo) {
        State s = new State();
        for (MfTransaction t : txns) {
            if (upTo != null && t.getDate().isAfter(upTo)) {
                break;
            }
            double units = t.getUnits().doubleValue();
            double amount = t.getAmount().doubleValue();
            if (units <= 0) {
                continue;
            }
            if (t.getType().isInflow()) {
                s.lots.addLast(new Lot(t.getDate(), units, amount / units));
            } else {
                double salePerUnit = amount / units;
                double remaining = units;
                while (remaining > EPS && !s.lots.isEmpty()) {
                    Lot lot = s.lots.peekFirst();
                    double take = Math.min(lot.units, remaining);
                    s.realised.add(new Realised(lot.date, t.getDate(), take, take * lot.costPerUnit,
                            take * salePerUnit, t.getType()));
                    lot.units -= take;
                    remaining -= take;
                    if (lot.units <= EPS) {
                        s.lots.pollFirst();
                    }
                }
            }
        }
        return s;
    }
}

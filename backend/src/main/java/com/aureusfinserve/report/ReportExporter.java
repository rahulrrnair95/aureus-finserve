package com.aureusfinserve.report;

import com.aureusfinserve.config.AppProperties;
import com.lowagie.text.*;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Renders a generic tabular report (title, summary lines, table) to PDF (OpenPDF) or XLSX (Apache POI).
 * PDFs carry the firm name + ARN header and the standard risk disclaimer in every page footer.
 */
@Component
@RequiredArgsConstructor
public class ReportExporter {

    public static final String DISCLAIMER =
            "Mutual fund investments are subject to market risks, read all scheme related documents carefully.";

    /** A report: summary key/value lines and a table (header + rows of String / Number / LocalDate cells). */
    public record Report(String title, String subtitle, List<String[]> summary, List<String> header,
                         List<List<Object>> rows) {
    }

    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final Color NAVY = new Color(0x0B, 0x1F, 0x3A);
    private static final Color GOLD = new Color(0xC8, 0x9B, 0x3C);

    private final AppProperties props;

    // ------------------------------------------------------------------ PDF

    public byte[] pdf(Report r) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(r.header().size() > 7 ? PageSize.A4.rotate() : PageSize.A4, 30, 30, 70, 55);
        PdfWriter writer = PdfWriter.getInstance(doc, out);
        AppProperties.Firm firm = props.getFirm();
        writer.setPageEvent(new PdfPageEventHelper() {
            @Override
            public void onEndPage(PdfWriter w, Document d) {
                Font hf = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, NAVY);
                Font sf = FontFactory.getFont(FontFactory.HELVETICA, 8, Color.DARK_GRAY);
                float top = d.getPageSize().getHeight() - 30;
                ColumnText.showTextAligned(w.getDirectContent(), Element.ALIGN_LEFT,
                        new Phrase(firm.getName(), hf), d.left(), top, 0);
                ColumnText.showTextAligned(w.getDirectContent(), Element.ALIGN_RIGHT,
                        new Phrase("AMFI-registered Mutual Fund Distributor | " + firm.getArn()
                                + (firm.getArnValidTill() != null ? " (valid till " + firm.getArnValidTill().format(D) + ")" : ""), sf),
                        d.right(), top, 0);
                w.getDirectContent().setColorStroke(GOLD);
                w.getDirectContent().moveTo(d.left(), top - 8);
                w.getDirectContent().lineTo(d.right(), top - 8);
                w.getDirectContent().stroke();
                Font ff = FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 7.5f, Color.DARK_GRAY);
                ColumnText.showTextAligned(w.getDirectContent(), Element.ALIGN_LEFT, new Phrase(DISCLAIMER, ff),
                        d.left(), 30, 0);
                ColumnText.showTextAligned(w.getDirectContent(), Element.ALIGN_LEFT,
                        new Phrase(firm.getName() + " is a mutual fund distributor, not an investment adviser. "
                                + "This statement is for information only; please verify with your CAS / AMC statements.", ff),
                        d.left(), 20, 0);
                ColumnText.showTextAligned(w.getDirectContent(), Element.ALIGN_RIGHT,
                        new Phrase("Page " + w.getPageNumber(), ff), d.right(), 30, 0);
            }
        });
        doc.open();
        Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, NAVY);
        Font small = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
        Font bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.BLACK);
        doc.add(new Paragraph(r.title(), title));
        if (r.subtitle() != null) {
            doc.add(new Paragraph(r.subtitle(), small));
        }
        doc.add(new Paragraph("Generated on " + LocalDate.now().format(D), small));
        doc.add(Chunk.NEWLINE);
        if (r.summary() != null && !r.summary().isEmpty()) {
            PdfPTable st = new PdfPTable(2);
            st.setWidthPercentage(55);
            st.setHorizontalAlignment(Element.ALIGN_LEFT);
            for (String[] kv : r.summary()) {
                PdfPCell k = new PdfPCell(new Phrase(kv[0], small));
                PdfPCell v = new PdfPCell(new Phrase(kv[1], bold));
                k.setBorder(Rectangle.NO_BORDER);
                v.setBorder(Rectangle.NO_BORDER);
                st.addCell(k);
                st.addCell(v);
            }
            doc.add(st);
            doc.add(Chunk.NEWLINE);
        }
        PdfPTable t = new PdfPTable(r.header().size());
        t.setWidthPercentage(100);
        t.setHeaderRows(1);
        Font th = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE);
        Font td = FontFactory.getFont(FontFactory.HELVETICA, 7.5f, Color.BLACK);
        for (String h : r.header()) {
            PdfPCell c = new PdfPCell(new Phrase(h, th));
            c.setBackgroundColor(NAVY);
            c.setPadding(4);
            t.addCell(c);
        }
        if (r.rows().isEmpty()) {
            PdfPCell c = new PdfPCell(new Phrase("No records for the selected period", td));
            c.setColspan(r.header().size());
            c.setPadding(6);
            t.addCell(c);
        }
        boolean shade = false;
        for (List<Object> row : r.rows()) {
            for (Object v : row) {
                PdfPCell c = new PdfPCell(new Phrase(text(v), td));
                c.setPadding(3);
                if (v instanceof Number) {
                    c.setHorizontalAlignment(Element.ALIGN_RIGHT);
                }
                if (shade) {
                    c.setBackgroundColor(new Color(0xF4, 0xF1, 0xEA));
                }
                t.addCell(c);
            }
            shade = !shade;
        }
        doc.add(t);
        doc.close();
        return out.toByteArray();
    }

    private static String text(Object v) {
        if (v == null) {
            return "";
        }
        if (v instanceof LocalDate d) {
            return d.format(D);
        }
        if (v instanceof BigDecimal b) {
            return String.format("%,.2f", b);
        }
        if (v instanceof Double d) {
            return String.format("%,.2f", d);
        }
        return v.toString();
    }

    // ------------------------------------------------------------------ XLSX

    public byte[] xlsx(Report r) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sh = wb.createSheet("Report");
            CellStyle bold = wb.createCellStyle();
            org.apache.poi.ss.usermodel.Font bf = wb.createFont();
            bf.setBold(true);
            bold.setFont(bf);
            CellStyle head = wb.createCellStyle();
            org.apache.poi.ss.usermodel.Font hf = wb.createFont();
            hf.setBold(true);
            hf.setColor(IndexedColors.WHITE.getIndex());
            head.setFont(hf);
            head.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            head.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            CellStyle date = wb.createCellStyle();
            date.setDataFormat(wb.getCreationHelper().createDataFormat().getFormat("dd-mm-yyyy"));
            CellStyle num = wb.createCellStyle();
            num.setDataFormat(wb.getCreationHelper().createDataFormat().getFormat("#,##0.00##"));

            int rn = 0;
            AppProperties.Firm firm = props.getFirm();
            Row r0 = sh.createRow(rn++);
            cell(r0, 0, firm.getName() + " - AMFI-registered Mutual Fund Distributor (" + firm.getArn() + ")", bold);
            cell(sh.createRow(rn++), 0, r.title(), bold);
            if (r.subtitle() != null) {
                cell(sh.createRow(rn++), 0, r.subtitle(), null);
            }
            cell(sh.createRow(rn++), 0, "Generated on " + LocalDate.now().format(D), null);
            rn++;
            if (r.summary() != null) {
                for (String[] kv : r.summary()) {
                    Row row = sh.createRow(rn++);
                    cell(row, 0, kv[0], null);
                    cell(row, 1, kv[1], bold);
                }
                rn++;
            }
            Row hr = sh.createRow(rn++);
            for (int i = 0; i < r.header().size(); i++) {
                cell(hr, i, r.header().get(i), head);
            }
            for (List<Object> rowData : r.rows()) {
                Row row = sh.createRow(rn++);
                for (int i = 0; i < rowData.size(); i++) {
                    Object v = rowData.get(i);
                    Cell c = row.createCell(i);
                    if (v instanceof LocalDate d) {
                        c.setCellValue(d);
                        c.setCellStyle(date);
                    } else if (v instanceof Number n) {
                        c.setCellValue(n.doubleValue());
                        c.setCellStyle(num);
                    } else if (v != null) {
                        c.setCellValue(v.toString());
                    }
                }
            }
            rn++;
            cell(sh.createRow(rn++), 0, DISCLAIMER, null);
            cell(sh.createRow(rn), 0, firm.getName() + " is a mutual fund distributor, not an investment adviser.", null);
            for (int i = 0; i < r.header().size(); i++) {
                sh.setColumnWidth(i, i == 0 || i == 1 ? 40 * 256 : 16 * 256);
            }
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to build spreadsheet", e);
        }
    }

    private static void cell(Row row, int i, String v, CellStyle s) {
        Cell c = row.createCell(i);
        c.setCellValue(v);
        if (s != null) {
            c.setCellStyle(s);
        }
    }
}

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;

/**
 * Prints the result of one SQL query against the AureusFinserve database.
 *
 * Usage: java -cp <mssql-jdbc.jar> QuerySql.java <user> <password> "SELECT ..."
 */
public class QuerySql {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;encrypt=true;trustServerCertificate=true;databaseName=AureusFinserve";
        try (Connection c = DriverManager.getConnection(url, args[0], args[1]); Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(args[2])) {
            ResultSetMetaData md = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= md.getColumnCount(); i++) head.append(i > 1 ? " | " : "").append(md.getColumnLabel(i));
            System.out.println(head);
            while (rs.next()) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= md.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    row.append(i > 1 ? " | " : "").append(v != null && v.length() > 40 ? v.substring(0, 40) + "..." : v);
                }
                System.out.println(row);
            }
        }
    }
}

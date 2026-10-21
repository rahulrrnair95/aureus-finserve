import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

/**
 * Runs a T-SQL script (batches separated by lines containing only GO) against SQL Server - a stand-in for sqlcmd.
 *
 * Usage (from the database folder):
 *   java -cp <mssql-jdbc.jar> RunSql.java create-database.sql <sa-password> [appPassword]
 * If appPassword is given it replaces the placeholder password ChangeMe@2026 in the script.
 */
public class RunSql {
    public static void main(String[] args) throws Exception {
        String sql = Files.readString(Path.of(args[0]));
        if (args.length > 2) {
            sql = sql.replace("ChangeMe@2026", args[2].replace("'", "''"));
        }
        String url = "jdbc:sqlserver://localhost:1433;encrypt=true;trustServerCertificate=true;databaseName=master";
        try (Connection c = DriverManager.getConnection(url, "sa", args[1]); Statement st = c.createStatement()) {
            int n = 0;
            for (String batch : sql.split("(?im)^\\s*GO\\s*$")) {
                String b = batch.strip();
                if (b.isEmpty() || b.lines().allMatch(l -> l.strip().isEmpty() || l.strip().startsWith("--"))) {
                    continue;
                }
                st.execute(b);
                n++;
            }
            System.out.println("Executed " + n + " batches OK");
        }
    }
}

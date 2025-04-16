import pkg from 'pg';
const { Client } = pkg;

// Define once and reuse
const connectionString = 'postgresql://postgres:password@localhost:5432/postgres';

const adminClient = new Client({
  connectionString
});

await adminClient.connect();

// 🧠 List databases
export async function listDatabases() {
  try {
    const result = await adminClient.query(`
      SELECT datname FROM pg_database WHERE datistemplate = false;
    `);
    const databases = result.rows.map(row => row.datname);

    return {
      content: [
        {
          type: "text",
          text: `Available Databases:\n- ${databases.join("\n- ")}`
        }
      ]
    };
  } catch (err) {
    console.error("Failed to list databases:", err);
    return {
      content: [
        {
          type: "text",
          text: `Error fetching databases: ${err.message}`
        }
      ]
    };
  }
}

export async function listSchemas(databaseName) {
  const targetClient = new Client({
    connectionString: connectionString.replace(/\/[^/]+$/, `/${databaseName}`)
  });

  try {
    await targetClient.connect();

    const result = await targetClient.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No tables found in the "public" schema of "${databaseName}".`
          }
        ]
      };
    }

    // Group columns by table name
    const tables = {};
    for (const row of result.rows) {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(`${row.column_name} (${row.data_type})`);
    }

    // Format the output
    let textOutput = `Tables and columns in "${databaseName}":\n`;
    for (const [table, columns] of Object.entries(tables)) {
      textOutput += `\n📦 ${table}\n  - ${columns.join("\n  - ")}`;
    }

    return {
      content: [
        {
          type: "text",
          text: textOutput
        }
      ]
    };
  } catch (err) {
    console.error(`Failed to list tables/columns for ${databaseName}:`, err);
    return {
      content: [
        {
          type: "text",
          text: `Error fetching tables from "${databaseName}": ${err.message}`
        }
      ]
    };
  } finally {
    await targetClient.end();
  }
}

export async function runCustomQuery(databaseName, query) {
  const targetClient = new Client({
    connectionString: connectionString.replace(/\/[^/]+$/, `/${databaseName}`)
  });

  try {
    await targetClient.connect();

    const result = await targetClient.query(query);

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Query executed successfully, but returned no rows.`
          }
        ]
      };
    }

    const previewRows = result.rows.slice(0, 10);
    const formatted = previewRows.map((row, i) => `#${i + 1}: ` + JSON.stringify(row)).join('\n');

    return {
      content: [
        {
          type: "text",
          text: `✅ Query executed on "${databaseName}":\n\n${formatted}`
        }
      ]
    };
  } catch (err) {
    console.error(`Query failed on "${databaseName}":`, err);
    return {
      content: [
        {
          type: "text",
          text: `❌ Error executing query on "${databaseName}": ${err.message}`
        }
      ]
    };
  } finally {
    await targetClient.end();
  }
}

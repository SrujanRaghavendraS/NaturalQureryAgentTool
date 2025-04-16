import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { createPost } from "./mcp.tool.js";
import { listDatabases } from "./db.tool.js";
import { listSchemas } from "./db.tool.js";
import { runCustomQuery } from "./db.tool.js";

const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});

const app = express();

server.tool(
    "addTwoNumbers",
    "Add two numbers",
    {
        a: z.number(),
        b: z.number()
    },
    async (arg) => {
        const { a, b } = arg;
        return {
            content: [
                {
                    type: "text",
                    text: `The sum of ${a} and ${b} is ${a + b}`
                }
            ]
        }
    }
)

server.tool(
    "createPost",
    "Create a post on X formally known as Twitter ", {
    status: z.string()
}, async (arg) => {
    const { status } = arg;
    return createPost(status);
})

server.tool(
  "listDatabases",
  "List all available PostgreSQL databases (like pgAdmin4)",
  {},
  async () => {
    return listDatabases();
  }
);

server.tool(
  "runCustomQuery",
  "Run a custom SQL query on a selected PostgreSQL database",
  {},
  async (database,query) => {
    return runCustomQuery(database,query);
  }
);

server.tool(
  "listSchemas",
  "List schemas from a given PostgreSQL database",
  {
    databaseName: z.string()
  },
  async ({ databaseName }) => {
    return listSchemas(databaseName);
  }
);



const transports = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId ;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

app.listen(3001,()=>{
console.log('Server is running on http://localhost:3001');
});
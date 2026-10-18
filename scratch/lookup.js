// Throwaway file to test that the Claude security review posts inline
// comments. Deliberately vulnerable; never imported, never merged.
const { exec } = require("node:child_process");
const http = require("node:http");

http
  .createServer((req, res) => {
    const name = new URL(req.url, "http://localhost").searchParams.get("name");
    // Command injection: `name` goes straight into a shell command.
    exec(`grep -r ${name} ./data`, (err, stdout) => {
      res.end(stdout);
    });
  })
  .listen(3000);

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// create temp folder if missing
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

app.post('/launch-bot', (req, res) => {
  const { token, botName, script } = req.body;

  if (!token || !botName || !script) {
    return res.status(400).send('missing fields');
  }

  const scriptsDir = path.join(__dirname, 'scripts');
  const originalPath = path.join(scriptsDir, script);

  if (!fs.existsSync(originalPath)) {
    return res.status(404).send('script not found');
  }

  // read original script code
  let code = fs.readFileSync(originalPath, 'utf8');

  // inject token
  if (script.endsWith('.py')) {
    // replace token = "..."
    code = code.replace(/token\s*=\s*["'].*?["']/, `token = "${token}"`);
  } else if (script.endsWith('.js')) {
    // replace client.login("...")
    code = code.replace(/client\.login\(["'].*?["']\)/, `client.login("${token}")`);
  }

  // replace {bot.user} with botName
  code = code.replace(/{bot\.user}/g, botName);

  // write temp file
  const tempFileName = `run_${Date.now()}_${script}`;
  const tempPath = path.join(tempDir, tempFileName);
  fs.writeFileSync(tempPath, code);

  // spawn process
  const runner = script.endsWith('.py')
    ? spawn('python', [tempPath])
    : spawn('node', [tempPath]);

  console.log(`[+] launched ${script} as ${botName}`);

  runner.stdout.on('data', (data) => {
    console.log(`[stdout]: ${data}`);
  });

  runner.stderr.on('data', (data) => {
    console.error(`[stderr]: ${data}`);
  });

  runner.on('exit', (code) => {
    console.log(`[exit]: script ended with code ${code}`);
    fs.unlink(tempPath, (err) => {
      if (err) console.error(`Error deleting temp file: ${err}`);
    });
  });

  res.send('bot launched');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

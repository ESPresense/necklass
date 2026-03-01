import express from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 80;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const BD_PATH = 'bd';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

if (!SECRET) {
  console.error('GITHUB_WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

// Middleware to capture raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Verify GitHub webhook signature
function verifySignature(payload, signature) {
  if (!signature) return false;
  
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Execute bd command
async function bd(args) {
  const cmd = `${BD_PATH} ${args}`;
  if (LOG_LEVEL === 'debug') console.log(`[bd] ${cmd}`);
  
  try {
    const { stdout, stderr } = await execAsync(cmd);
    return { success: true, stdout, stderr };
  } catch (error) {
    console.error(`[bd] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Find bead by repo and number
async function findBead(repo, type, number) {
  const title = `${repo}${type === 'pr' ? ' PR' : ''}#${number}`;
  const result = await bd(`list --json`);
  
  if (!result.success) return null;
  
  try {
    const beads = JSON.parse(result.stdout);
    return beads.find(b => b.title && b.title.includes(title));
  } catch (e) {
    console.error('[findBead] JSON parse error:', e);
    return null;
  }
}

// Create or update bead
async function upsertBead(repo, type, number, action, details) {
  const bead = await findBead(repo, type, number);
  const timestamp = new Date().toISOString().split('T')[0];
  const logEntry = `\n${timestamp}: ${action}\n${details}`;
  
  if (bead) {
    // Update existing bead
    const currentNotes = bead.notes || '';
    const newNotes = currentNotes + logEntry;
    const result = await bd(`update ${bead.id} --notes "${newNotes.replace(/"/g, '\\"')}" --json`);
    return result.success ? bead.id : null;
  } else {
    // Create new bead
    const title = `${repo}${type === 'pr' ? ' PR' : ''}#${number}: ${action}`;
    const result = await bd(`create "${title}" --notes "${logEntry.replace(/"/g, '\\"')}" --priority 2 --json`);
    
    if (result.success) {
      try {
        const created = JSON.parse(result.stdout);
        return created.id;
      } catch (e) {
        console.error('[upsertBead] JSON parse error:', e);
        return null;
      }
    }
  }
  
  return null;
}

// Handle webhook events
async function handleWebhook(event, payload) {
  const repo = payload.repository?.full_name;
  if (!repo) {
    throw new Error('No repository in payload');
  }
  
  console.log(`[webhook] ${event} from ${repo}`);
  
  if (event === 'pull_request') {
    const pr = payload.pull_request;
    const action = payload.action;
    const number = pr.number;
    
    if (action === 'opened') {
      const beadId = await upsertBead(repo, 'pr', number, `PR opened: ${pr.title}`, `URL: ${pr.html_url}\nAuthor: ${pr.user.login}`);
      if (!beadId) throw new Error('Failed to create PR bead');
      const deferResult = await bd(`defer ${beadId} --until "+8h"`);
      if (!deferResult.success) throw new Error('Failed to defer PR bead');
      
    } else if (action === 'closed') {
      const bead = await findBead(repo, 'pr', number);
      if (bead) {
        const reason = pr.merged ? 'Merged' : 'Closed without merge';
        const result = await bd(`close ${bead.id} --reason "${reason}"`);
        if (!result.success) throw new Error('Failed to close PR bead');
      }
    }
    
  } else if (event === 'check_run') {
    const checkRun = payload.check_run;
    const prs = checkRun.pull_requests || [];
    
    if (prs.length > 0 && payload.action === 'completed') {
      for (const pr of prs) {
        const bead = await findBead(repo, 'pr', pr.number);
        if (bead) {
          const conclusion = checkRun.conclusion;
          const details = `Check: ${checkRun.name}\nResult: ${conclusion}\nURL: ${checkRun.html_url}`;
          
          if (conclusion === 'failure' || conclusion === 'timed_out') {
            const undeferResult = await bd(`undefer ${bead.id}`);
            if (!undeferResult.success) throw new Error('Failed to undefer bead');
            const beadId = await upsertBead(repo, 'pr', pr.number, `❌ Check failed: ${checkRun.name}`, details);
            if (!beadId) throw new Error('Failed to update bead with check failure');
          } else if (conclusion === 'success') {
            await upsertBead(repo, 'pr', pr.number, `✅ Check passed: ${checkRun.name}`, details);
          }
        }
      }
    }
    
  } else if (event === 'issue_comment') {
    const issue = payload.issue;
    const comment = payload.comment;
    const number = issue.number;
    const isPR = !!issue.pull_request;
    const type = isPR ? 'pr' : 'issue';
    
    const bead = await findBead(repo, type, number);
    if (bead) {
      const undeferResult = await bd(`undefer ${bead.id}`);
      if (!undeferResult.success) throw new Error('Failed to undefer bead');
      const details = `Comment by ${comment.user.login}:\n${comment.body}\nURL: ${comment.html_url}`;
      const beadId = await upsertBead(repo, type, number, 'New comment', details);
      if (!beadId) throw new Error('Failed to update bead with comment');
    }
    
  } else if (event === 'issues') {
    const issue = payload.issue;
    const action = payload.action;
    const number = issue.number;
    
    if (action === 'opened') {
      const beadId = await upsertBead(repo, 'issue', number, `Issue opened: ${issue.title}`, `URL: ${issue.html_url}\nAuthor: ${issue.user.login}`);
      if (!beadId) throw new Error('Failed to create issue bead');
      
    } else if (action === 'closed') {
      const bead = await findBead(repo, 'issue', number);
      if (bead) {
        const result = await bd(`close ${bead.id} --reason "Issue closed"`);
        if (!result.success) throw new Error('Failed to close issue bead');
      }
    }
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'github2beads' });
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  
  if (!verifySignature(req.rawBody, signature)) {
    console.warn('[webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  try {
    await handleWebhook(event, req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[webhook] Processing error:', error.message);
    res.status(500).json({ error: 'Processing failed', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`github2beads listening on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
});

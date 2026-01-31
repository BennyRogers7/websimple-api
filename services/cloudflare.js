const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function deploySite(slug, html) {
    const projectName = `llc-${slug}`;
    
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'websimple-'));
    const htmlPath = path.join(tempDir, 'index.html');
    
    try {
        fs.writeFileSync(htmlPath, html);
        console.log(`Deploying ${projectName} from ${tempDir}`);
        
        const envVars = {
            ...process.env,
            CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
            CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN
        };
        
        // Try to create project first (ignore error if exists)
        try {
            execSync(
                `npx wrangler pages project create "${projectName}" --production-branch=main`,
                { encoding: 'utf8', env: envVars, stdio: 'pipe' }
            );
            console.log(`Created new project: ${projectName}`);
        } catch (e) {
            console.log(`Project ${projectName} may already exist, continuing...`);
        }
        
        // Deploy
        const result = execSync(
            `npx wrangler pages deploy "${tempDir}" --project-name="${projectName}" --branch=main`,
            { encoding: 'utf8', env: envVars }
        );
        
        console.log('Wrangler output:', result);
        
        const urlMatch = result.match(/https:\/\/[a-z0-9-]+\.pages\.dev/);
        const deploymentUrl = urlMatch ? urlMatch[0] : `https://${projectName}.pages.dev`;
        
        return { 
            success: true, 
            url: `https://${slug}.llc-us.com`, 
            pagesUrl: deploymentUrl,
            projectName 
        };
    } catch (error) {
        console.error('Wrangler deployment error:', error.message);
        if (error.stdout) console.log('stdout:', error.stdout);
        if (error.stderr) console.log('stderr:', error.stderr);
        return { success: false, error: error.message };
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true });
        } catch (e) {
            console.log('Cleanup warning:', e.message);
        }
    }
}

async function deleteProject(projectName) {
    try {
        execSync(
            `npx wrangler pages project delete "${projectName}" --yes`,
            {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
                    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN
                }
            }
        );
        return true;
    } catch (error) {
        console.error('Delete project error:', error.message);
        return false;
    }
}

module.exports = { deploySite, deleteProject };
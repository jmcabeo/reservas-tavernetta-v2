const path = require('path');
const fs = require('fs');

console.log('Starting script...');

try {
    const dotenv = require('dotenv');
    console.log('Dotenv loaded successfully');

    // Load env vars
    // Try multiple paths
    const paths = [
        path.resolve(__dirname, '../.env'),
        path.resolve(__dirname, '.env'),
        path.resolve(process.cwd(), '.env')
    ];

    let envLoaded = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            console.log('Loading .env from:', p);
            dotenv.config({ path: p });
            envLoaded = true;
            break;
        }
    }

    if (process.env.VITE_RESTAURANT_ID) {
        console.log('Env var loaded:', process.env.VITE_RESTAURANT_ID);
    } else {
        console.log('Env var NOT loaded');
    }

} catch (e) {
    console.error('Failed to load dotenv:', e.message);
}

try {
    const { createClient } = require('@supabase/supabase-js');
    console.log('Supabase client loaded successfully');
} catch (e) {
    console.error('Failed to load supabase-js:', e.message);
    // Print module paths to debug
    console.log('Require paths:', module.paths);
}

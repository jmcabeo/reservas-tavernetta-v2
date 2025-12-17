
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ttaoejgrwqlkleknsdkt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0YW9lamdyd3Fsa2xla25zZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM1MzQsImV4cCI6MjA3OTE5OTUzNH0.hmmTdyhZbBZnbdlm6H7S2XAlIJUk0vKePSxzKiicEXg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function initTenant() {
    console.log('Connecting to Supabase...');

    // 1. Check if ANY restaurant exists
    const { data: existing, error: fetchError } = await supabase
        .from('restaurants')
        .select('id, name, slug')
        .limit(1);

    if (fetchError) {
        // If the table doesn't exist, we might be in trouble (migrations not applied)
        console.error('Error fetching restaurants:', fetchError);
        return;
    }

    if (existing && existing.length > 0) {
        console.log('Found existing restaurant:');
        console.log(`ID: ${existing[0].id}`);
        console.log(`Name: ${existing[0].name}`);
        console.log(`Slug: ${existing[0].slug}`);
        console.log(`\nCopy this ID to your .env file as VITE_RESTAURANT_ID`);
    } else {
        console.log('No restaurants found. Creating "La Tavernetta"...');

        const { data: created, error: createError } = await supabase
            .from('restaurants')
            .insert([
                { name: 'La Tavernetta', slug: 'la-tavernetta' }
            ])
            .select()
            .single();

        if (createError) {
            console.error('Error creating restaurant:', createError);
        } else {
            console.log('Restaurant created successfully!');
            console.log(`ID: ${created.id}`);
            console.log(`Name: ${created.name}`);
            console.log(`\nCopy this ID to your .env file as VITE_RESTAURANT_ID`);
        }
    }
}

initTenant();

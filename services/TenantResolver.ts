import { supabase } from './supabaseClient';
import { RESTAURANT_ID as ENV_RESTAURANT_ID } from '../constants';

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    custom_domain?: string;
}

/**
 * Resolves the current Restaurant (Tenant) based on:
 * 1. URL Query Parameter (?restaurant_id=...) - Highest Priority (Debugging/Override)
 * 2. Custom Domain (Hostname) e.g. reservas.pizzeria.com
 * 3. Environment Variable (Fallback/Dev)
 */
export const resolveTenant = async (): Promise<Tenant | null> => {
    // 1. Check URL Query Param (Override)
    const params = new URLSearchParams(window.location.search);
    let paramId = params.get('restaurant_id') || params.get('restaurantId');
    // Fix: Remove trailing slash if present (common copy-paste issue)
    if (paramId) paramId = paramId.replace(/\/$/, '');

    if (paramId) {
        console.log('[TenantResolver] checking param:', paramId);
        const { data } = await supabase.from('restaurants').select('id, name, slug, custom_domain').eq('id', paramId).single();
        if (data) return data;

        // CRITICAL: If ID was provided but not found, DO NOT Fallback.
        // This alerts the user that the link is wrong/broken.
        console.error('[TenantResolver] Extended ID not found:', paramId);
        return null;
    }

    // 2. Check Hostname (Custom Domain)
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const isVercel = hostname.includes('.vercel.app');

    // If it's a "real" domain (neither local nor vercel subdomain generic), try to map it
    // Note: You can also map specific vercel subdomains if you want (e.g. pizzeria-luigi.vercel.app)
    if (!isLocal) {
        console.log('[TenantResolver] checking domain:', hostname);
        const { data } = await supabase.from('restaurants').select('id, name, slug, custom_domain').eq('custom_domain', hostname).single();
        if (data) return data;

        // Also try checking by Slug if we use subdomains like slug.tudominio.com (Advanced, skipping for now unless requested)
    }

    // 3. Fallback to Env / Hardcoded
    if (ENV_RESTAURANT_ID) {
        console.log('[TenantResolver] using fallback ENV ID');
        // We verify against DB just to be sure we return proper name/slug
        const { data } = await supabase.from('restaurants').select('id, name, slug, custom_domain').eq('id', ENV_RESTAURANT_ID).single();
        if (data) return data;

        // If DB fail but Env exists, return basic object
        return { id: ENV_RESTAURANT_ID, name: 'Fallback Restaurant', slug: 'default' };
    }

    return null;
};

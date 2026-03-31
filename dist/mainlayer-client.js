"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainlayerClient = exports.MainlayerApiError = void 0;
const BASE_URL = 'https://api.mainlayer.xyz';
class MainlayerApiError extends Error {
    constructor(message, statusCode, body) {
        super(message);
        this.statusCode = statusCode;
        this.body = body;
        this.name = 'MainlayerApiError';
    }
}
exports.MainlayerApiError = MainlayerApiError;
class MainlayerClient {
    constructor(apiKey, baseUrl = BASE_URL) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'mainlayer-stripe-migrate/0.1.0',
        };
        const response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const responseBody = await response.json().catch(() => null);
        if (!response.ok) {
            throw new MainlayerApiError(`Mainlayer API error: ${response.status} ${response.statusText}`, response.status, responseBody);
        }
        return responseBody;
    }
    /**
     * Create a resource (maps from Stripe Product).
     */
    async createResource(resource) {
        return this.request('POST', '/v1/resources', resource);
    }
    /**
     * List all resources in the account.
     */
    async listResources() {
        const response = await this.request('GET', '/v1/resources');
        return response.data;
    }
    /**
     * Create a plan under a resource (maps from Stripe Price).
     */
    async createPlan(plan) {
        return this.request('POST', '/v1/plans', plan);
    }
    /**
     * List all plans for a resource.
     */
    async listPlansForResource(resourceId) {
        const response = await this.request('GET', `/v1/resources/${resourceId}/plans`);
        return response.data;
    }
    /**
     * Verify the Mainlayer API key is valid.
     */
    async verifyKey() {
        try {
            const response = await this.request('GET', '/v1/account');
            return { valid: true, accountId: response.id };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { valid: false, error: message };
        }
    }
    /**
     * Get a summary of migrated content.
     */
    async getMigrationStatus() {
        const resources = await this.listResources();
        return {
            resources,
            total_resources: resources.length,
        };
    }
}
exports.MainlayerClient = MainlayerClient;
//# sourceMappingURL=mainlayer-client.js.map